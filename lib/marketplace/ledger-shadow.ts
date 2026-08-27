/**
 * Ledger SHADOW evaluator — increment 2. LOG-ONLY, gated OFF, zero behaviour change.
 *
 * For each cross-marketplace SKU group it computes what the event ledger WOULD say
 * (Option A: debit at placement) and logs it beside the legacy pool number, PER ROW.
 * It appends order-driven events (consume/cancel/return) to stock_ledger so a real
 * shadow period accumulates a real history — but it NEVER:
 *   • feeds on_hand into computeAvailable (the legacy pool still drives everything),
 *   • writes a seed event (that's the separate seed-writer increment, not built here),
 *   • writes to any marketplace.
 *
 * Gated by LEDGER_SHADOW_ENABLED (default OFF). Off → this is a no-op, so merging it
 * changes nothing until a human flips the flag to start observing.
 *
 * Pre-seed note: with no seed events, on_hand is Σ(order deltas) only, so it runs
 * NEGATIVE and diff = on_hand − legacyAvailable will be large. That is expected and
 * is the whole reason to watch it on real passes before seeding — the shape of the
 * consume/cancel stream is what we're validating, not the absolute number.
 */

import { and, eq, inArray, gte, isNotNull, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, stockLedger } from '@/lib/db'
import { normalizeKey } from '@/lib/db/stock-groups'
import { reservingOrderCondition } from '@/lib/marketplace/reserving-orders'
import { computeAvailable, type SyncMember } from '@/lib/marketplace/stock-allocation'
import {
  diffLedger, ledgerOnHand, ledgerKey,
  type LedgerEvent, type OrderDrivenReason,
} from '@/lib/marketplace/stock-ledger'
import {
  toGroupOrders, comparisonRows, formatShadowRow,
  type RawGroupOrder, type ShadowMember,
} from './ledger-shadow-pure'
import type { MarketplaceType } from '@/lib/types'
import { logger } from '@/lib/logger'

/**
 * Read the flag at RUNTIME, inside a function — never at module scope.
 *
 * A module-scope `const X = process.env.LEDGER_SHADOW_ENABLED === 'true'` is the
 * bug that kept the evaluator dark: the bundler inlines `process.env.X`, and when
 * X is absent at BUILD time it becomes `undefined`, folding `=== 'true'` to a
 * compile-time `false` and dead-code-eliminating the whole call — so the flag can
 * never turn on at runtime no matter what the process env says. Every other
 * kill-switch in the app (cancel-restore, autorenew, lifecycle) reads inside a
 * function for exactly this reason. Match them.
 */
export function ledgerShadowEnabled(): boolean {
  return /^(1|true|on|yes)$/i.test((process.env.LEDGER_SHADOW_ENABLED ?? '').trim())
}

// Bound the order scan: a cancel/return only emits when its consume is already
// recorded, and consumes are recorded while the order is recent, so a 90-day
// window is ample and keeps the shadow query cheap.
const ORDER_WINDOW_DAYS = 90

interface Member {
  productId: string
  marketplace: MarketplaceType
  sku: string | null
  physicalStock: number | null
  listedStock: number
  fulfillmentType: string | null
  pending: number
}

/**
 * Run the shadow comparison for one user's groups. Best-effort and self-contained:
 * any failure is logged and swallowed so it can never disturb the sync that calls it.
 */
export async function runLedgerShadow(userId: string, shopIds: string[]): Promise<void> {
  if (!ledgerShadowEnabled()) return
  if (shopIds.length === 0) return
  try {
    const since = new Date(Date.now() - ORDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const [productRows, pendingRows, orderRows, ledgerRows] = await Promise.all([
      db.select({
        id: products.id, shop_id: products.shop_id, sku: products.sku,
        physical_stock: products.physical_stock, stock_quantity: products.stock_quantity,
        fulfillment_type: products.fulfillment_type, marketplace: shops.marketplace,
      }).from(products).innerJoin(shops, eq(shops.id, products.shop_id))
        .where(and(inArray(products.shop_id, shopIds), eq(products.is_archived, false), isNotNull(products.sku))),
      // Reserving units per product — the SAME definition the write engine uses.
      db.select({
        product_id: orderItems.product_id,
        qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
      }).from(orderItems).innerJoin(orders, eq(orderItems.order_id, orders.id))
        .where(and(inArray(orders.shop_id, shopIds), reservingOrderCondition()))
        .groupBy(orderItems.product_id),
      // One row per (product, order): summed qty + raw & normalized status.
      db.select({
        product_id: orderItems.product_id,
        order_id_external: orders.order_id_external,
        marketplace: shops.marketplace,
        raw_status: orders.marketplace_status,
        normalized_status: orders.status,
        qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .innerJoin(shops, eq(shops.id, orders.shop_id))
        .where(and(inArray(orders.shop_id, shopIds), isNotNull(orders.order_id_external), gte(orders.ordered_at, since)))
        .groupBy(orderItems.product_id, orders.order_id_external, shops.marketplace, orders.marketplace_status, orders.status),
      db.select({
        match_key: stockLedger.match_key, delta: stockLedger.delta,
        reason: stockLedger.reason, order_id_external: stockLedger.order_id_external,
      }).from(stockLedger).where(eq(stockLedger.user_id, userId)),
    ])

    const pendingByProduct = new Map(pendingRows.map(r => [r.product_id, Number(r.qty)]))
    const skuByProduct = new Map<string, string | null>()

    // Group members by normalized SKU (the same key stock_ledger.match_key stores).
    const membersByKey = new Map<string, Member[]>()
    for (const p of productRows) {
      const key = normalizeKey(p.sku!)
      skuByProduct.set(p.id, p.sku)
      const m: Member = {
        productId: p.id, marketplace: p.marketplace as MarketplaceType, sku: p.sku,
        physicalStock: p.physical_stock, listedStock: p.stock_quantity,
        fulfillmentType: p.fulfillment_type, pending: pendingByProduct.get(p.id) ?? 0,
      }
      const list = membersByKey.get(key); if (list) list.push(m); else membersByKey.set(key, [m])
    }

    // Roll orders up to (match_key → RawGroupOrder[]), summing per (group, order).
    const ordersByKey = new Map<string, Map<string, RawGroupOrder>>()
    for (const r of orderRows) {
      if (!r.product_id) continue
      const sku = skuByProduct.get(r.product_id)
      if (!sku || !r.order_id_external) continue
      const key = normalizeKey(sku)
      const perOrder = ordersByKey.get(key) ?? new Map<string, RawGroupOrder>()
      const existing = perOrder.get(r.order_id_external)
      if (existing) existing.qty += Number(r.qty)
      else perOrder.set(r.order_id_external, {
        orderIdExternal: r.order_id_external, marketplace: r.marketplace as MarketplaceType,
        qty: Number(r.qty), rawStatus: r.raw_status, normalizedStatus: r.normalized_status,
      })
      ordersByKey.set(key, perOrder)
    }

    // Existing ledger events grouped by match_key (for recordedKeys + on_hand).
    const eventsByKey = new Map<string, LedgerEvent[]>()
    for (const e of ledgerRows) {
      const list = eventsByKey.get(e.match_key) ?? []
      list.push({ delta: e.delta, reason: e.reason as LedgerEvent['reason'], orderIdExternal: e.order_id_external })
      eventsByKey.set(e.match_key, list)
    }

    let groupsLogged = 0, seededGroups = 0, eventsAppended = 0, groupsDiverging = 0
    for (const [key, members] of membersByKey) {
      const groupOrders = toGroupOrders([...(ordersByKey.get(key)?.values() ?? [])])
      const existing = eventsByKey.get(key) ?? []
      const seeded = existing.some(e => e.reason === 'seed')
      const recordedKeys = new Set(
        existing.filter(e => e.reason === 'consume' || e.reason === 'cancel' || e.reason === 'return')
          .map(e => ledgerKey(e.reason as OrderDrivenReason, e.orderIdExternal!)))

      const writes = diffLedger(groupOrders, recordedKeys)
      if (writes.length > 0) {
        await db.insert(stockLedger).values(writes.map(w => ({
          user_id: userId, match_key: key, delta: w.delta, reason: w.reason,
          order_id_external: w.orderIdExternal, marketplace: w.marketplace,
          note: 'shadow',
        }))).onConflictDoNothing()
        eventsAppended += writes.length
      }

      // Check (3) as a grep-able yes/no: a release (cancel/return) completes a
      // lifecycle for an order that was previously consumed. Log whether the
      // consume and release net to zero — i.e. the group returns to its pre-order
      // on-hand. This is seed-INDEPENDENT (the net is 0 regardless of any seed), so
      // it is the closest thing to proof the release logic works before seeding.
      for (const w of writes) {
        if (w.reason !== 'cancel' && w.reason !== 'return') continue
        const consumeDelta = existing.find(e => e.reason === 'consume' && e.orderIdExternal === w.orderIdExternal)?.delta ?? 0
        const nettedBack = consumeDelta + w.delta === 0
        logger.info('ledger_shadow_lifecycle', {
          matchKey: key, orderIdExternal: w.orderIdExternal, reason: w.reason,
          consumeDelta, releaseDelta: w.delta, nettedBack,
        })
        logger.info(`[ledger-shadow] lifecycle ${key} order=${w.orderIdExternal} ${w.reason} consume=${consumeDelta} release=${w.delta} nettedBack=${nettedBack}`)
      }

      const onHand = ledgerOnHand([...existing, ...writes.map(w => ({ delta: w.delta, reason: w.reason, orderIdExternal: w.orderIdExternal }))])
      const syncMembers: SyncMember[] = members.map(m => ({
        productId: m.productId, shopId: '', marketplace: m.marketplace, apiMode: 'read_only',
        priority: 0, listedStock: m.listedStock, physicalStock: m.physicalStock, pending: m.pending, sku: m.sku,
      }))
      const legacyAvailable = computeAvailable(syncMembers)   // legacy pool — NOT fed onHand

      const shadowMembers: ShadowMember[] = members.map(m => ({ marketplace: m.marketplace, sku: m.sku, physicalStock: m.physicalStock }))
      for (const row of comparisonRows(key, shadowMembers, legacyAvailable, onHand, seeded)) {
        logger.info('ledger_shadow_row', {
          matchKey: row.matchKey, marketplace: row.marketplace, sku: row.sku,
          legacyPhysicalStock: row.legacyPhysicalStock, legacyAvailable: row.legacyAvailable,
          ledgerOnHand: row.ledgerOnHand, seeded: row.seeded,
          // diff is omitted entirely when unseeded — it is uniformly −pool and
          // carries no signal, and printing it invites misreading it as corruption.
          ...(row.diff != null ? { diff: row.diff } : {}),
        })
        logger.info(formatShadowRow(row))
      }
      groupsLogged++
      if (seeded) seededGroups++
      // Divergence only means something once seeded — pre-seed every group "diverges".
      if (seeded && onHand !== legacyAvailable) groupsDiverging++
    }

    // Emitted on EVERY pass, including a zero one — a missing line (disabled or
    // errored → see ledger_shadow_failed) must never look like a quiet zero pass.
    logger.info('ledger_shadow_pass', { userId, groupsLogged, seededGroups, eventsAppended, groupsDiverging })
  } catch (e) {
    logger.warn('ledger_shadow_failed', { userId, error: String(e).slice(0, 200) })
  }
}
