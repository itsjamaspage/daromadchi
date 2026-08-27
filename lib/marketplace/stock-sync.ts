/**
 * Stock-sync orchestrator — the dual update.
 *
 *  Step A  recompute the shared available = max(0, MAX(stock across the group)
 *          − SUM(all pending across the group)) and refresh the display.
 *          Every group (read-only included) gets Step A.
 *  Step B  for each stock_sync store whose LISTED number differs from its target
 *          (per oversell_mode), push the new ostatok through the audited writer.
 *          Read-only stores never get Step B.
 *
 * Writes are stamped with a monotonic version and a single computed-at timestamp
 * (stable across retries). Nothing here bypasses lib/marketplace/stock-writer.ts.
 */

import { revalidateTag } from 'next/cache'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, stockSyncState, stockNotifyOrderSeen } from '@/lib/db'
import { logger } from '@/lib/logger'
import { pushStock, type StockWriteStatus } from '@/lib/marketplace/stock-writer'
import { userHasFeature } from '@/lib/billing/entitlement'
import { planStockWrites, planGroupWrites, stockWriteBack, detectNewOrders, rawGroupAvailable, decidePush, type PushHistory, type SyncMember, type OversellMode } from '@/lib/marketplace/stock-allocation'
import { reservingOrderCondition } from '@/lib/marketplace/reserving-orders'
import { handleOversell } from '@/lib/marketplace/oversell'
import { notifyStockUpdates, type StockUpdateEvent } from '@/lib/marketplace/stock-notify'
import { backfillShopIdentifiers } from '@/lib/marketplace/identifier-backfill'
import { decrypt } from '@/lib/crypto'
import { withStockSyncLock } from '@/lib/db/shop-lock'
import { fetchAllUzumSkuStocks } from '@/lib/uzum/client'
import { fetchYandexStockLocations } from '@/lib/yandex/client'
import type { MarketplaceType } from '@/lib/types'

const IN_SCOPE: MarketplaceType[] = ['uzum', 'yandex_market']

// A 'skipped' write worth notifying about: one where we couldn't target the
// write and the seller must fix config (missing identifier / token). Benign
// skips (stale_version dedup, not_stock_sync, marketplace_out_of_scope) stay
// silent so a busy seller isn't spammed on every cycle.
const ACTIONABLE_SKIP_REASONS = new Set([
  'missing_barcode', 'missing_sku', 'missing_warehouse', 'missing_campaign', 'no_token',
])

function normalizeKey(sku: string): string {
  return sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
}

interface ShopRow {
  id: string
  marketplace: MarketplaceType
  api_mode: 'read_only' | 'stock_sync'
  oversell_mode: OversellMode
  primary_channel_priority: number
  shop_id_external: string | null
  api_key_encrypted: string | null
}

interface ProductRow {
  id: string
  shop_id: string
  sku: string | null
  stock_quantity: number
  physical_stock: number | null
  market_barcode: string | null
  market_sku: string | null
  market_warehouse_id: string | null
  title: string | null
  variant_color: string | null
  selling_price: string | null
}

export interface StockSyncLogEntry {
  matchKey: string
  marketplace: MarketplaceType
  shopId: string
  productId: string
  available: number
  listed: number
  target: number
  version: number
  status: StockWriteStatus
  reason?: string
}

export interface StockSyncRunResult {
  computedAt: string
  groupsConsidered: number
  writesPlanned: number
  entries: StockSyncLogEntry[]
  /** True when another run for this user was already in flight and this call
   *  did nothing. Not an error — cron fires again in five minutes. */
  skippedLocked?: boolean
}

/** A run that did nothing, shaped so callers need no special case. */
function emptyStockSyncRun(): StockSyncRunResult {
  return {
    computedAt: new Date().toISOString(),
    groupsConsidered: 0,
    writesPlanned: 0,
    entries: [],
  }
}

interface RunOptions {
  userId: string
  /** Restrict to a single normalized match key (first-live / targeted runs). */
  onlyMatchKey?: string
}

interface SyncGroup {
  members: SyncMember[]
  products: Map<string, ProductRow>
  /** Ids (orders.id) of the reserving orders drawing on this group right now —
   *  the raw material for the new-order notification gate (detectNewOrders). */
  reservingOrderIds: Set<string>
}

async function loadGroups(userId: string): Promise<{
  shopsById: Map<string, ShopRow>
  groups: Map<string, SyncGroup>
}> {
  const shopRows = (await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_mode: shops.api_mode,
    oversell_mode: shops.oversell_mode,
    primary_channel_priority: shops.primary_channel_priority,
    shop_id_external: shops.shop_id_external,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops).where(and(eq(shops.user_id, userId), eq(shops.is_active, true)))) as ShopRow[]

  const shopsById = new Map(shopRows.filter(s => IN_SCOPE.includes(s.marketplace)).map(s => [s.id, s]))
  const shopIds = [...shopsById.keys()]
  const groups = new Map<string, SyncGroup>()
  if (shopIds.length === 0) return { shopsById, groups }

  const [prodRows, pendingRows, reservingRows] = await Promise.all([
    db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      stock_quantity: products.stock_quantity,
      physical_stock: products.physical_stock,
      market_barcode: products.market_barcode,
      market_sku: products.market_sku,
      market_warehouse_id: products.market_warehouse_id,
      title: products.title,
      variant_color: products.variant_color,
      selling_price: products.selling_price,
    }).from(products).where(inArray(products.shop_id, shopIds)) as Promise<ProductRow[]>,
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      // Only orders that RESERVE stock draw down available: a PAID, committed
      // order (Uzum PACKING and later / Yandex PROCESSING and later), from order
      // ingestion — so the sibling listing drops right away. Unpaid drafts (Uzum
      // CREATED, Yandex UNPAID) keep listings full so a cancelled draft can't
      // phantom-out the other channel. Shared condition, see
      // reservingOrderCondition / RESERVING_RAW_STATUSES.
      .where(and(inArray(orders.shop_id, shopIds), reservingOrderCondition()))
      .groupBy(orderItems.product_id),
    // Per-product reserving ORDER ids (distinct) — feeds the new-order gate. Same
    // reserving predicate as the pending sum above, but keeps order identity so a
    // genuinely new sale can be told apart from a repeat reconcile write.
    db.select({
      product_id: orderItems.product_id,
      order_id: orders.id,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(inArray(orders.shop_id, shopIds), reservingOrderCondition()))
      .groupBy(orderItems.product_id, orders.id),
  ])

  const pendingByProduct = new Map(pendingRows.map(r => [r.product_id, Number(r.qty)]))
  // product_id → reserving order ids on it (product_id can be null when a Yandex
  // line never linked to a products row — those are un-attributable, exactly as
  // the pending sum drops them, so nothing over-counts).
  const orderIdsByProduct = new Map<string, string[]>()
  for (const r of reservingRows) {
    if (!r.product_id || !r.order_id) continue
    const arr = orderIdsByProduct.get(r.product_id)
    if (arr) arr.push(r.order_id); else orderIdsByProduct.set(r.product_id, [r.order_id])
  }

  for (const p of prodRows) {
    const shop = shopsById.get(p.shop_id)
    if (!shop) continue
    const key = p.sku ? normalizeKey(p.sku) : `#${p.id}`
    let g = groups.get(key)
    if (!g) { g = { members: [], products: new Map(), reservingOrderIds: new Set() }; groups.set(key, g) }
    g.products.set(p.id, p)
    for (const oid of orderIdsByProduct.get(p.id) ?? []) g.reservingOrderIds.add(oid)
    g.members.push({
      productId: p.id,
      shopId: p.shop_id,
      marketplace: shop.marketplace,
      apiMode: shop.api_mode,
      priority: shop.primary_channel_priority,
      listedStock: p.stock_quantity,
      physicalStock: p.physical_stock,
      pending: pendingByProduct.get(p.id) ?? 0,
      sku: p.sku,
    })
  }
  return { shopsById, groups }
}

// ─── New-order notification gate: seen reserving-order sets ────────────────────
// The digest fires on a genuinely NEW reserving order (a real sale), never on a
// repeat reconcile write. We remember, per (user, match_key), the reserving order
// ids we've already accounted for; detectNewOrders() compares the current set.

function sameStringSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

// Batch-load every group's seen reserving-order set for the user (one query).
// On a read failure returns an empty map → a group's set reads as empty →
// detectNewOrders treats its open orders as new (FAIL-OPEN: notify, with the
// (target, available) dedup as backstop) rather than silently swallowing a sale.
async function loadSeenOrderIds(userId: string): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  try {
    const rows = await db.select({
      key: stockNotifyOrderSeen.match_key,
      ids: stockNotifyOrderSeen.seen_order_ids,
    }).from(stockNotifyOrderSeen).where(eq(stockNotifyOrderSeen.user_id, userId))
    for (const r of rows) {
      const ids = Array.isArray(r.ids) ? (r.ids as unknown[]).filter((x): x is string => typeof x === 'string') : []
      out.set(r.key, new Set(ids))
    }
  } catch (err) {
    logger.warn('stock_notify_order_seen_read_failed', { userId, error: String(err).slice(0, 200) })
  }
  return out
}

// Persist the current reserving-order set for one group (upsert). Best-effort —
// a miss only risks one duplicate/missed gate later, never a crash.
async function saveSeenOrderIds(userId: string, matchKey: string, ids: string[]): Promise<void> {
  try {
    await db.insert(stockNotifyOrderSeen).values({
      user_id: userId, match_key: matchKey, seen_order_ids: ids, updated_at: new Date(),
    }).onConflictDoUpdate({
      target: [stockNotifyOrderSeen.user_id, stockNotifyOrderSeen.match_key],
      set: { seen_order_ids: ids, updated_at: new Date() },
    })
  } catch (err) {
    logger.warn('stock_notify_order_seen_write_failed', { userId, error: String(err).slice(0, 200) })
  }
}

// Resolve the group's oversell policy from the primary (lowest-priority)
// stock_sync shop, with an explicit fallback. `writable` is guaranteed non-empty
// and stock_sync-only by the caller, so the primary is never read-only; the
// ?? 'off' still guards a missing/unknown value so the result is never
// undefined. Default is 'off' (mirror-always) — matches the column default.
function resolveOversellPolicy(
  writable: SyncMember[],
  shopsById: Map<string, ShopRow>,
): { mode: OversellMode; sourceShopId: string | null } {
  const primary = [...writable].sort((a, b) => a.priority - b.priority)[0]
  if (!primary) return { mode: 'off', sourceShopId: null }
  const mode = shopsById.get(primary.shopId)?.oversell_mode ?? 'off'
  return { mode, sourceShopId: primary.shopId }
}

// Bump and return the monotonic version for (shop, match-key), recording the
// last decision. Called once per real write, before pushing.
async function bumpVersion(
  shopId: string, matchKey: string, productId: string,
  available: number, target: number, repeatCount: number,
): Promise<number> {
  const [existing] = await db.select({ version: stockSyncState.version })
    .from(stockSyncState).where(and(eq(stockSyncState.shop_id, shopId), eq(stockSyncState.sku, matchKey)))
  const newVersion = (existing?.version ?? 0) + 1
  const now = new Date()
  await db.insert(stockSyncState).values({
    shop_id: shopId, product_id: productId, sku: matchKey, version: newVersion,
    last_available: available, last_target: target, last_pushed_at: now,
    repeat_count: repeatCount, updated_at: now,
  }).onConflictDoUpdate({
    target: [stockSyncState.shop_id, stockSyncState.sku],
    set: {
      version: newVersion, product_id: productId, last_available: available,
      last_target: target, last_pushed_at: now, repeat_count: repeatCount, updated_at: now,
    },
  })
  return newVersion
}

/** Record a skip that made no marketplace call: keep last_target, move the run
 *  counter, and leave `version` alone (nothing was written to leapfrog). */
async function noteSkip(shopId: string, matchKey: string, target: number, repeatCount: number): Promise<void> {
  await db.update(stockSyncState)
    .set({ last_target: target, repeat_count: repeatCount, updated_at: new Date() })
    .where(and(eq(stockSyncState.shop_id, shopId), eq(stockSyncState.sku, matchKey)))
}

/**
 * Ensure the stock-WRITE identifiers are populated before any write is planned.
 * Uzum keys on products.market_barcode and Yandex on products.market_sku (+
 * market_warehouse_id); the product/order sync never fills these — they come
 * from backfillShopIdentifiers (read-only endpoints). Without them every write
 * skips (missing_barcode / missing_sku), which is exactly what a live sale hit.
 *
 * Runs a shop's backfill ONLY when it still has a product missing its
 * identifier, so once populated this is a cheap existence check with no
 * marketplace call — safe to call on every sync/webhook trigger. Best-effort:
 * a backfill failure never blocks the sync (the write simply skips as before).
 */
async function ensureWriteIdentifiers(userId: string): Promise<void> {
  const shopRows = await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
  }).from(shops).where(and(
    eq(shops.user_id, userId),
    eq(shops.is_active, true),
    eq(shops.api_mode, 'stock_sync'),
    inArray(shops.marketplace, IN_SCOPE),
  ))

  for (const s of shopRows) {
    if (!s.api_key_encrypted) continue
    // Uzum needs market_barcode; Yandex needs market_sku (+ warehouse, set
    // together with market_sku by the backfill).
    const missingCol = s.marketplace === 'uzum' ? products.market_barcode : products.market_sku
    const [missing] = await db.select({ id: products.id }).from(products)
      .where(and(eq(products.shop_id, s.id), isNull(missingCol))).limit(1)
    if (!missing) continue
    try {
      await backfillShopIdentifiers({
        id: s.id,
        marketplace: s.marketplace,
        api_key_encrypted: s.api_key_encrypted,
        shop_id_external: s.shop_id_external,
      })
    } catch (err) {
      logger.warn('ensure_write_identifiers_failed', { shopId: s.id, error: String(err).slice(0, 200) })
    }
  }
}

/**
 * Run Step A + Step B for every SKU group that has at least one stock_sync
 * member. Returns a log of every planned write with its actual result.
 */
/**
 * One stock write-back run per USER at a time.
 *
 * This is the path that writes to a marketplace, so overlapping runs are the
 * costliest kind: the stock value itself is idempotent (both runs set the same
 * target), but detectNewOrders is stateful, so two runs can each classify the
 * same order as new — one live sale, two Telegram alerts and two stock_write_log
 * rows. Keyed on userId because a sync group can span a seller's shops; see
 * lib/db/shop-lock.ts.
 *
 * A refused run reports ok with skippedLocked rather than an error: cron fires
 * this every 5 minutes, and two ticks brushing past each other is not a fault.
 */
export async function syncStockSyncGroups(opts: RunOptions): Promise<StockSyncRunResult> {
  const outcome = await withStockSyncLock(opts.userId, () => syncStockSyncGroupsLocked(opts))
  if (outcome.ran) return outcome.value
  return { ...emptyStockSyncRun(), skippedLocked: true }
}

async function syncStockSyncGroupsLocked(opts: RunOptions): Promise<StockSyncRunResult> {
  const computedAt = new Date().toISOString()

  // Plan gate. This is an ADDITIONAL condition on top of the per-shop api_mode
  // guard in stock-writer.ts — it can only ever refuse a write, never permit one
  // that guard would deny (AGENTS.md). Placed at the top of the run rather than
  // per write so a gated account also stops emitting stock-update notifications,
  // which are dispatched from the events this run collects. Low-stock alerts are
  // a different flag and are untouched: Free keeps those.
  if (!await userHasFeature(opts.userId, 'stock_sync')) {
    logger.info('stock_sync_plan_gated', { userId: opts.userId })
    return { computedAt, groupsConsidered: 0, writesPlanned: 0, entries: [] }
  }
  // Self-heal the write identifiers before planning, so a live write always has
  // a target (Uzum barcode / YM shopSku+warehouse) instead of skipping.
  await ensureWriteIdentifiers(opts.userId)
  const { shopsById, groups } = await loadGroups(opts.userId)
  // Seen reserving-order sets per group — the new-order notification gate. Loaded
  // once for the whole run; per-group updates are written back only when the set
  // actually changed, so idle cycles issue zero writes here.
  const seenByKey = await loadSeenOrderIds(opts.userId)
  const entries: StockSyncLogEntry[] = []
  // Collected across the run and dispatched once at the end (best-effort). Only
  // actual write attempts (sent / error / blocked) become notification events.
  const notifyEvents: StockUpdateEvent[] = []
  let groupsConsidered = 0
  let writesPlanned = 0
  let anyDisplayChange = false

  // Live Uzum FBS-linked state — fetched lazily once per Uzum shop per run and
  // memoized, so a run with no Uzum writes pays nothing. A SKU the seller hasn't
  // stocked in their Uzum FBS warehouse comes back fbsLinked:false, and every
  // write to it returns validation-failed-001 (HTTP 400): 280+ noise rows/day in
  // stock_write_log plus alerts for products they aren't even selling. We skip
  // those writes silently (in the loop below). Best-effort: if the read fails the
  // map is empty and nothing is skipped, so writes proceed exactly as before.
  // barcode → { fbsLinked, dbsLinked }: fbsLinked gates the write (explicit false
  // skips); both flags are echoed into the FBS stock-write body (required fields).
  type UzumLinkFlags = { fbsLinked: boolean; dbsLinked: boolean }
  const uzumFbsLinkedCache = new Map<string, Map<string, UzumLinkFlags>>()
  async function uzumFbsLinkedFor(shop: ShopRow): Promise<Map<string, UzumLinkFlags>> {
    const cached = uzumFbsLinkedCache.get(shop.id)
    if (cached) return cached
    const map = new Map<string, UzumLinkFlags>()
    if (shop.marketplace === 'uzum' && shop.api_key_encrypted) {
      try {
        const stocks = await fetchAllUzumSkuStocks(decrypt(shop.api_key_encrypted))
        for (const s of stocks) {
          const bc = String(s.barcode ?? '').trim()
          if (bc && typeof s.fbsLinked === 'boolean') {
            map.set(bc, { fbsLinked: s.fbsLinked, dbsLinked: s.dbsLinked === true })
          }
        }
      } catch (err) {
        logger.warn('uzum_fbs_linked_fetch_failed', { shopId: shop.id, error: String(err).slice(0, 200) })
      }
    }
    uzumFbsLinkedCache.set(shop.id, map)
    return map
  }

  for (const [matchKey, group] of groups) {
    if (opts.onlyMatchKey && matchKey !== opts.onlyMatchKey) continue
    const writableMembers = group.members.filter(m => m.apiMode === 'stock_sync')
    if (writableMembers.length === 0) continue // Step A only (display), no writes
    groupsConsidered++

    // New-order NOTIFICATION gate. A digest fires ONLY when a genuinely new
    // reserving order appeared for this group since the last run — a real sale.
    // A pure reconcile write (an idempotent stock correction with no new order —
    // e.g. the mirror re-asserting a listing, a restock, an identifier backfill)
    // still updates the marketplaces, but does so SILENTLY. This is the PRIMARY
    // gate; the (target, available) dedup in notifyStockUpdates is the secondary
    // safety for concurrent triggers. The reconcile WRITE path below is NOT gated
    // — only the notification is.
    const seen = seenByKey.get(matchKey) ?? new Set<string>()
    const { hasNewOrder, nextSeen } = detectNewOrders([...group.reservingOrderIds], [...seen])
    if (!sameStringSet(seen, group.reservingOrderIds)) {
      await saveSeenOrderIds(opts.userId, matchKey, nextSeen)
    }

    // Oversell policy: the primary (lowest-priority) stock_sync shop decides.
    // Default 'off' (mirror-always) if — for any reason — the primary is missing
    // or carries no policy. Never resolve to undefined.
    const { mode: oversellMode, sourceShopId } = resolveOversellPolicy(writableMembers, shopsById)

    const { available, plans } = planStockWrites(group.members, oversellMode)
    anyDisplayChange = true // available may have moved; refresh the display

    // Oversell detection: the raw (pre-clamp) shared free-to-sell below zero means
    // the same physical unit was sold more than once. Uses the SAME physical-pool
    // computation as `available` (rawGroupAvailable), NOT the throttled listing —
    // measuring the pool off the listing double-counted a normal last-unit sale
    // (listing driven to 0 by the sale while the order was still pending → −1) and
    // fired a false oversell alert. Alert + (rate-limited) auto-cancel.
    const rawAvailable = rawGroupAvailable(group.members)
    if (rawAvailable < 0) {
      try {
        await handleOversell({
          userId: opts.userId,
          matchKey,
          // Prefer the human product title for the alert; fall back to SKU/key.
          title: group.products.get([...group.products.keys()][0] ?? '')?.title
            ?? group.members[0]?.sku ?? matchKey,
          rawAvailable,
          productIds: [...group.products.keys()],
        })
      } catch (err) {
        logger.error('oversell_handler_failed', { matchKey, error: String(err).slice(0, 300) })
      }
    }

    // Group-level REASSERT: if ANY writable member has a real diff, re-push EVERY
    // writable member to its target — even one whose (possibly-stale) listedStock
    // already equals target. The sale-origin marketplace auto-adjusts its own live
    // stock but our stock_quantity copy for it can lag, so a per-member equality
    // would wrongly skip the listing that needs re-raising (the stale-Yandex root
    // cause). A fully-unchanged group still writes NOTHING (strict no-op).
    const toWrite = planGroupWrites({ available, plans })
    // Log which shop's policy governed this group the first time it actually
    // drives a write, so unexpected group behaviour later is traceable.
    if (toWrite.length > 0) {
      const realDiffs = plans.filter(p => p.willWrite).length
      logger.info('stock_sync_policy_applied', { matchKey, oversellMode, sourceShopId, available, writes: toWrite.length, realDiffs })
    }

    // What we last sent to each of these listings. The reassert above
    // deliberately ignores per-member equality, so this is the only thing that
    // can tell a re-push that is DOING something from one that is repeating
    // itself. Loaded once per group rather than per member.
    const historyByShop = new Map<string, PushHistory>()
    if (toWrite.length > 0) {
      const rows = await db.select({
        shop_id: stockSyncState.shop_id,
        last_target: stockSyncState.last_target,
        repeat_count: stockSyncState.repeat_count,
      }).from(stockSyncState).where(and(
        eq(stockSyncState.sku, matchKey),
        inArray(stockSyncState.shop_id, toWrite.map(p => p.member.shopId)),
      ))
      for (const r of rows) {
        historyByShop.set(r.shop_id, { lastTarget: r.last_target, repeatCount: r.repeat_count })
      }
    }

    for (const plan of toWrite) {
      const shop = shopsById.get(plan.member.shopId)!
      const product = group.products.get(plan.member.productId)!

      // Have we already sent this exact value to this listing? A member that
      // agrees with a target we already pushed is being reasserted on another
      // member's behalf and has nothing to say; a value we have pushed
      // NON_CONVERGENCE_LIMIT times without the listing agreeing is not going to
      // start working on attempt N+1. Either way: no marketplace call.
      const decision = decidePush(plan, historyByShop.get(plan.member.shopId))
      if (!decision.push) {
        if (decision.reason === 'not_converging') {
          logger.warn('stock_write_not_converging', {
            matchKey, marketplace: shop.marketplace, shopId: shop.id, productId: product.id,
            target: plan.target, listed: plan.member.listedStock, attempts: decision.repeatCount,
          })
        }
        entries.push({
          matchKey, marketplace: shop.marketplace, shopId: shop.id, productId: product.id,
          available, listed: plan.member.listedStock, target: plan.target, version: 0,
          status: 'skipped', reason: decision.reason,
        })
        await noteSkip(shop.id, matchKey, plan.target, decision.repeatCount)
        continue
      }

      writesPlanned++

      // Resolve the write identifier just before pushing.
      const barcode = shop.marketplace === 'uzum' ? product.market_barcode : null
      const marketSku = shop.marketplace === 'yandex_market' ? product.market_sku : product.sku
      const warehouseId = shop.marketplace === 'yandex_market' ? product.market_warehouse_id : null

      // Silent skip: never attempt a Uzum write for a SKU the seller hasn't
      // linked to their FBS warehouse (fbsLinked:false → guaranteed HTTP 400).
      // Uzum-only, keyed on the LIVE fbsLinked value; ONLY an explicit false
      // skips, so linked SKUs (e.g. a stocked variant) and any SKU we couldn't
      // read still write normally. No pushStock call → no stock_write_log row and
      // no notification. Auto-resumes when the seller restocks (fbsLinked flips
      // true on the next run's read) — no code change needed for that transition.
      // Uzum link flags: gate the write on fbsLinked (explicit false skips) and
      // capture both flags to echo into the write body. Default true/false when
      // the barcode isn't in the FBS list (or the read failed).
      let uzumFbsLinked: boolean | undefined
      let uzumDbsLinked: boolean | undefined
      if (shop.marketplace === 'uzum' && barcode) {
        const linked = await uzumFbsLinkedFor(shop)
        const flags = linked.get(barcode.trim())
        if (flags?.fbsLinked === false) {
          entries.push({
            matchKey, marketplace: shop.marketplace, shopId: shop.id, productId: product.id,
            available, listed: plan.member.listedStock, target: plan.target, version: 0,
            status: 'skipped', reason: 'fbs_not_linked',
          })
          continue
        }
        if (flags) { uzumFbsLinked = flags.fbsLinked; uzumDbsLinked = flags.dbsLinked }
      }

      const version = await bumpVersion(shop.id, matchKey, product.id, available, plan.target, decision.repeatCount)
      const result = await pushStock({
        shop: {
          id: shop.id,
          marketplace: shop.marketplace,
          api_key_encrypted: shop.api_key_encrypted,
          shop_id_external: shop.shop_id_external,
          api_mode: shop.api_mode,
        },
        sku: marketSku,
        barcode,
        // Uzum FBS stock-update (POST /v2/fbs/sku/stocks) requires all 5 fields;
        // it keys on the FBS skuId (products.market_sku). Yandex path is unaffected.
        uzumSkuId: shop.marketplace === 'uzum' ? product.market_sku : null,
        uzumFbsLinked,
        uzumDbsLinked,
        quantity: plan.target,
        version,
        warehouseId,
        productId: product.id,
        updatedAt: computedAt,
        freshnessKey: matchKey,
      })

      entries.push({
        matchKey, marketplace: shop.marketplace, shopId: shop.id, productId: product.id,
        available, listed: plan.member.listedStock, target: plan.target, version,
        status: result.status, reason: result.reason,
      })

      // Write-back: on a SUCCESSFUL push, keep our products.stock_quantity copy in
      // lockstep with what we just wrote to the live listing, so willWrite doesn't
      // re-fire the same throttle every cycle. This touches ONLY stock_quantity
      // (the outbound listing view) — NEVER physical_stock (the pool). The pool is
      // computed from physical_stock alone (computeAvailable), so this write-back
      // can no longer shrink `available`; it's the listing that moves, not the
      // pool. Best-effort — a miss only risks one redundant reassert later.
      const writeBack = stockWriteBack(result.status, plan.target, product.stock_quantity)
      if (writeBack !== null) {
        try {
          await db.update(products).set({ stock_quantity: writeBack }).where(eq(products.id, product.id))
        } catch (err) {
          logger.warn('stock_writeback_failed', { productId: product.id, error: String(err).slice(0, 200) })
        }
      }

      // Notify on an actual write attempt — 'sent' (success), 'error'/'blocked'
      // (real failure) — AND on an ACTIONABLE skip (missing identifier/token the
      // seller must fix), so a stock update is never silently dropped. Benign
      // skips (stale_version, not_stock_sync, killed switch) stay silent.
      //
      // GATED on hasNewOrder: only a run that saw a genuinely new reserving order
      // for this group emits notification events. A pure reconcile write (no new
      // order) has already corrected the marketplace above; it does so SILENTLY —
      // no digest, no restock line. This is what stops the same 2→1 correction
      // re-notifying every cron cycle.
      const actionableSkip = result.status === 'skipped'
        && !!result.reason && ACTIONABLE_SKIP_REASONS.has(result.reason)
      if (hasNewOrder && (result.status === 'sent' || result.status === 'error' || result.status === 'blocked' || actionableSkip)) {
        // Origin = the other group member with the most stock — the store that
        // held the unit and sold it, decrementing its own count.
        const origin = group.members
          .filter(m => m.productId !== plan.member.productId)
          .sort((a, b) => b.listedStock - a.listedStock)[0]
        notifyEvents.push({
          sku: plan.member.sku ?? matchKey,
          targetMarketplace: shop.marketplace,
          originMarketplace: origin?.marketplace ?? null,
          listed: plan.member.listedStock,
          target: plan.target,
          ok: result.status === 'sent',
          reason: result.status === 'sent' ? undefined : (result.reason ?? result.status),
          // Product identity for the Telegram/in-app header: full name, colour,
          // price (same physical product across the group).
          name: product.title,
          colorKey: product.variant_color,
          price: product.selling_price != null ? Number(product.selling_price) : null,
          // GROUP shared free-to-sell after this update — drives the restock line.
          available,
        })
      }
    }
  }

  // Cross-store stock-update notifications (in-app + Telegram, per-user toggles,
  // result-accurate). Best-effort — never blocks the sync.
  await notifyStockUpdates(opts.userId, notifyEvents)

  // Step A: refresh the display so the recomputed available shows immediately.
  if (anyDisplayChange) {
    revalidateTag('product-data', { expire: 0 })
    revalidateTag('order-data', { expire: 0 })
  }

  logger.info('stock_sync_run', {
    userId: opts.userId, computedAt, groupsConsidered, writesPlanned,
  })
  return { computedAt, groupsConsidered, writesPlanned, entries }
}

// ─── Read-back verification (first live push) ─────────────────────────────────
// After a live write, re-read the SKU from the store and confirm the number
// actually changed — a silent 200 that didn't move the value (wrong barcode /
// warehouse / stale timestamp) is the failure mode that looks like success.
export async function readBackStock(
  shop: { marketplace: MarketplaceType; api_key_encrypted: string | null; shop_id_external?: string | null },
  identifier: string,
): Promise<number | null> {
  if (!shop.api_key_encrypted) return null
  const token = decrypt(shop.api_key_encrypted)
  try {
    if (shop.marketplace === 'uzum') {
      const stocks = await fetchAllUzumSkuStocks(token)
      const rec = stocks.find(s => String(s.barcode ?? '').trim() === identifier.trim())
      if (!rec) return null
      const n = rec.amount ?? rec.quantityActive
      return typeof n === 'number' ? n : null
    }
    if (shop.marketplace === 'yandex_market') {
      const campaignId = shop.shop_id_external?.trim()
      if (!campaignId) return null
      const locations = await fetchYandexStockLocations(token, campaignId)
      return locations.get(identifier.trim())?.count ?? null
    }
  } catch (err) {
    logger.warn('stock_read_back_failed', { marketplace: shop.marketplace, error: String(err).slice(0, 200) })
  }
  return null
}

export interface FirstLiveResult {
  productId: string
  status: StockWriteStatus
  target: number
  pushed: boolean
  observed: number | null
  verified: boolean
  reason?: string
}

/**
 * A single verified live write: push one hand-picked product LIVE, then read it
 * back to prove the marketplace actually shows the new number (a bare 200 is not
 * trusted). `quantity` overrides the planned target — used by the restore step
 * to set the SKU back to its correct real stock and verify that write too.
 */
export async function verifiedLivePush(userId: string, productId: string, quantity?: number): Promise<FirstLiveResult> {
  const fail = (reason: string, target = 0): FirstLiveResult =>
    ({ productId, status: 'skipped', target, pushed: false, observed: null, verified: false, reason })

  await ensureWriteIdentifiers(userId)
  const { shopsById, groups } = await loadGroups(userId)

  // Find the product's group + member.
  let found: { matchKey: string; member: SyncMember; product: ProductRow; available: number; target: number } | null = null
  for (const [matchKey, group] of groups) {
    const product = group.products.get(productId)
    if (!product) continue
    const oversellMode = shopsById.get(product.shop_id)?.oversell_mode ?? 'lock_last_unit'
    const { available, plans } = planStockWrites(group.members, oversellMode)
    const plan = plans.find(p => p.member.productId === productId)
    if (!plan) return fail('product_not_stock_sync')
    found = { matchKey, member: plan.member, product, available, target: plan.target }
    break
  }
  if (!found) return fail('product_not_found')

  const target = quantity != null ? Math.max(0, Math.trunc(quantity)) : found.target

  const shop = shopsById.get(found.product.shop_id)
  if (!shop) return fail('shop_not_found', target)
  if (shop.api_mode !== 'stock_sync') return fail('shop_read_only', target)
  // Same additional condition as the batch run: a gated account cannot fire a
  // live write from the first-live button either. The api_mode check above stays
  // exactly where it is — this is layered on top of it, not instead of it.
  if (!await userHasFeature(userId, 'stock_sync')) return fail('plan_gated', target)

  const barcode = shop.marketplace === 'uzum' ? found.product.market_barcode : null
  const marketSku = shop.marketplace === 'yandex_market' ? found.product.market_sku : found.product.sku
  const warehouseId = shop.marketplace === 'yandex_market' ? found.product.market_warehouse_id : null
  const identifier = shop.marketplace === 'uzum' ? barcode : marketSku
  if (!identifier) return fail('missing_identifier', target)

  // repeatCount 0: this is a deliberate, human-triggered push, and it reads the
  // result back to prove the value landed. A person retrying a value the cron
  // gave up on is asserting it is right NOW, so the run of failed attempts
  // starts over rather than inheriting the cron's.
  const version = await bumpVersion(shop.id, found.matchKey, found.product.id, found.available, target, 0)
  const result = await pushStock({
    shop: {
      id: shop.id, marketplace: shop.marketplace, api_key_encrypted: shop.api_key_encrypted,
      shop_id_external: shop.shop_id_external, api_mode: shop.api_mode,
    },
    sku: marketSku, barcode, quantity: target, version, warehouseId,
    productId: found.product.id, updatedAt: new Date().toISOString(), freshnessKey: found.matchKey,
  })

  if (result.status !== 'sent') {
    return { productId, status: result.status, target, pushed: false, observed: null, verified: false, reason: result.reason }
  }

  const observed = await readBackStock(shop, identifier)
  const verified = observed === target
  logger.info('verified_live_read_back', { productId, marketplace: shop.marketplace, target, observed, verified })
  return { productId, status: 'sent', target, pushed: true, observed, verified }
}

/**
 * The controlled first live write: one hand-picked product at its planned target,
 * pushed LIVE and read back. Thin wrapper over verifiedLivePush.
 */
export function firstLivePush(userId: string, productId: string): Promise<FirstLiveResult> {
  return verifiedLivePush(userId, productId)
}
