/**
 * Manual stock reminders for READ-ONLY shops.
 *
 * A shop in `read_only` mode never has its ostatok written by Daromadchi — that
 * is the whole point of the mode, and AGENTS.md makes it a hard rule. The
 * consequence today is silence: when a unit sells on Uzum, the linked Yandex
 * listing keeps advertising stock the seller no longer has, and nothing tells
 * them. syncStockSyncGroups() skips those groups outright
 * (`writableMembers.length === 0 → continue`), so a read-only seller gets no
 * stock notification of any kind.
 *
 * This fills that gap with the only thing a read-only integration is allowed to
 * do: say the number out loud. "Uzum sold the last one, set JMWHT on Yandex
 * Market to 0." The seller types it in themselves.
 *
 * ── This module cannot write to a marketplace ────────────────────────────────
 * Not by policy — by construction. It imports no HTTP client, no marketplace
 * SDK, and nothing that transitively reaches stock-writer.ts, order-cancel.ts
 * or marketplaceFetch. That is asserted as a transitive-reachability test in
 * manual-stock-reminder.test.ts, so an import that opened a write path would
 * fail the suite rather than pass review.
 *
 * Note it deliberately does NOT import loadGroups from stock-sync.ts, even
 * though that would save duplicating the query below: stock-sync.ts imports
 * pushStock from stock-writer.ts, so reusing it would put a live write path one
 * hop from this file and make the guarantee above unprovable. The narrower
 * loader here is the price of that.
 */

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, userSettings, alerts } from '@/lib/db'
import { reservingOrderCondition } from '@/lib/marketplace/reserving-orders'
import { computeAvailable, type SyncMember } from '@/lib/marketplace/stock-allocation'
import { stockNotifyState } from '@/lib/db/schema'
import { notifT, normalizeLang, type NotifLang } from '@/lib/notif-i18n'
import { sendSellerMessageTo } from '@/lib/telegram-seller'
import { logger } from '@/lib/logger'
import type { MarketplaceType } from '@/lib/types'

const IN_SCOPE: MarketplaceType[] = ['uzum', 'yandex_market']

const MP_LABEL: Record<string, string> = {
  uzum: 'Uzum Market',
  yandex_market: 'Yandex Market',
}

/**
 * Dedup rows for this feature live in stock_notify_state alongside the
 * write-digest's rows, keyed by the same (user_id, sku, marketplace) unique
 * index. The SKU is prefixed so the two features can never overwrite each
 * other's state: without it, a manual reminder for JMWHT/yandex_market and a
 * write digest for JMWHT/yandex_market would fight over one row and each would
 * silence the other.
 */
export function dedupKeyFor(sku: string): string {
  return `manual:${sku}`
}

export interface ManualStockGroup {
  /** Normalized cross-marketplace match key for this physical product. */
  matchKey: string
  members: SyncMember[]
  /** products.title, for context in the message. */
  title: string | null
}

export interface ManualStockFix {
  sku: string
  marketplace: MarketplaceType
  /** What the read-only listing currently advertises. */
  listed: number
  /** The number the seller should set — the group's free-to-sell. */
  target: number
  title: string | null
}

/**
 * PURE. Which read-only listings are advertising the wrong number, and what the
 * right number is.
 *
 * Two conditions, both deliberate:
 *
 *  1. The group must span at least two marketplaces. A product listed on one
 *     marketplace only has nothing to reconcile against — its listing IS the
 *     truth — so "set it to N" would be Daromadchi telling the seller to change
 *     a number we derived from that same number.
 *
 *  2. Mirror-always: the target is the group's free-to-sell, full stop. No
 *     lock-last-unit or partition allocation. Those exist to divide a scarce
 *     unit between channels WE control the writes for; we control nothing here,
 *     so the honest number to report is the real one.
 *
 * `target` comes from computeAvailable — the same function the write path uses
 * to decide what to push — so a read-only seller is told exactly the number a
 * stock_sync seller would have had written for them.
 */
export function planManualStockFixes(groups: ManualStockGroup[]): ManualStockFix[] {
  const fixes: ManualStockFix[] = []
  for (const g of groups) {
    if (g.members.length === 0) continue
    const marketplaces = new Set(g.members.map(m => m.marketplace))
    if (marketplaces.size < 2) continue // not a linked cross-marketplace group

    const target = computeAvailable(g.members)
    for (const m of g.members) {
      if (m.apiMode !== 'read_only') continue      // stock_sync members are written for
      if (m.listedStock === target) continue        // already correct — nothing to say
      fixes.push({
        sku: m.sku ?? g.matchKey,
        marketplace: m.marketplace,
        listed: m.listedStock,
        target,
        title: g.title,
      })
    }
  }
  return fixes
}

/** PURE. One grouped message for every listing the seller needs to fix by hand. */
export function buildManualStockMessage(fixes: ManualStockFix[], lang: NotifLang = 'uz'): string {
  const T = notifT(lang)
  const lines: string[] = [T.manualStockTitle(fixes.length), T.manualStockSub, '']
  for (const f of fixes) {
    const name = f.title?.trim()
    const label = MP_LABEL[f.marketplace] ?? f.marketplace
    lines.push(T.manualStockLine(name ? `${f.sku} — ${name}` : f.sku, f.target, label))
  }
  lines.push('')
  lines.push(T.manualStockCta)
  return lines.join('\n')
}

/**
 * PURE. Drop the fixes we have already told this seller about.
 *
 * The fingerprint is the target number. While free-to-sell has not moved, the
 * advice has not changed either, so repeating it every 5 minutes would train the
 * seller to mute the bot. A new sale moves the target and the reminder returns.
 *
 * Trade-off worth knowing: a seller who half-fixes a listing (sets 5 where we
 * asked for 0) is not re-nudged until the target itself moves, because `listed`
 * is not part of the key. Fingerprinting on the target alone is what keeps an
 * unchanged situation quiet, and re-nudging on every partial edit is the noisier
 * failure of the two.
 */
export function selectUnnotified(
  fixes: ManualStockFix[],
  lastTargetByKey: Map<string, number>,
): ManualStockFix[] {
  return fixes.filter(f => lastTargetByKey.get(`${dedupKeyFor(f.sku)}|${f.marketplace}`) !== f.target)
}

/** Load every cross-marketplace group for one user. Reads only. */
async function loadManualGroups(userId: string): Promise<ManualStockGroup[]> {
  const shopRows = await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_mode: shops.api_mode,
    primary_channel_priority: shops.primary_channel_priority,
  }).from(shops).where(and(eq(shops.user_id, userId), eq(shops.is_active, true)))

  const shopsById = new Map(
    shopRows.filter(s => IN_SCOPE.includes(s.marketplace as MarketplaceType)).map(s => [s.id, s]),
  )
  const shopIds = [...shopsById.keys()]
  if (shopIds.length === 0) return []

  const [prodRows, pendingRows] = await Promise.all([
    db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      stock_quantity: products.stock_quantity,
      physical_stock: products.physical_stock,
      title: products.title,
    }).from(products).where(inArray(products.shop_id, shopIds)),
    // Same reserving predicate the write path uses, so the number we tell the
    // seller matches the number we would have written. Sharing
    // reservingOrderCondition() rather than restating it is what keeps the two
    // from drifting apart.
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(inArray(orders.shop_id, shopIds), reservingOrderCondition()))
      .groupBy(orderItems.product_id),
  ])

  const pendingByProduct = new Map(pendingRows.map(r => [r.product_id, Number(r.qty)]))
  const byKey = new Map<string, ManualStockGroup>()

  for (const p of prodRows) {
    const shop = shopsById.get(p.shop_id)
    if (!shop) continue
    const key = p.sku ? p.sku.trim().toUpperCase() : `#${p.id}`
    let g = byKey.get(key)
    if (!g) { g = { matchKey: key, members: [], title: null }; byKey.set(key, g) }
    if (!g.title && p.title) g.title = p.title
    g.members.push({
      productId: p.id,
      shopId: p.shop_id,
      marketplace: shop.marketplace as MarketplaceType,
      apiMode: shop.api_mode as 'read_only' | 'stock_sync',
      priority: shop.primary_channel_priority,
      listedStock: p.stock_quantity,
      physicalStock: p.physical_stock,
      pending: pendingByProduct.get(p.id) ?? 0,
      sku: p.sku,
    })
  }
  return [...byKey.values()]
}

/**
 * Tell one seller which read-only listings to correct by hand.
 *
 * Not plan-gated. syncStockSyncGroups() is, because writing to a marketplace on
 * the seller's behalf is the paid feature; telling them a number is not, and
 * gating it would mean the sellers who cannot have it done for them are also the
 * ones not told. Free accounts keep this, like low-stock alerts.
 *
 * Best-effort throughout — a notification must never be able to fail a sync.
 */
export async function notifyManualStockUpdates(userId: string): Promise<void> {
  try {
    const [s] = await db.select({
      chat: userSettings.telegram_chat_id,
      on:   userSettings.notif_stock_manual,
      lang: userSettings.notif_lang,
    }).from(userSettings).where(eq(userSettings.user_id, userId))

    if (s?.on === false) return

    const fixes = planManualStockFixes(await loadManualGroups(userId))
    if (fixes.length === 0) return

    // Read the last target we advised, per listing.
    const lastTargetByKey = new Map<string, number>()
    for (const f of fixes) {
      try {
        const [prev] = await db.select({ target: stockNotifyState.last_target })
          .from(stockNotifyState).where(and(
            eq(stockNotifyState.user_id, userId),
            eq(stockNotifyState.sku, dedupKeyFor(f.sku)),
            eq(stockNotifyState.marketplace, f.marketplace),
          ))
        if (prev?.target != null) lastTargetByKey.set(`${dedupKeyFor(f.sku)}|${f.marketplace}`, prev.target)
      } catch (err) {
        // Fail OPEN: treat as unnotified. A missed read costs a duplicate
        // message; the opposite silently swallows a real change.
        logger.warn('manual_stock_dedup_read_failed', { userId, error: String(err).slice(0, 200) })
      }
    }

    const fresh = selectUnnotified(fixes, lastTargetByKey)
    if (fresh.length === 0) return

    const message = buildManualStockMessage(fresh, normalizeLang(s?.lang))

    // Mirror-always: both channels get it. Telegram delivery is judged by the
    // RETURN VALUE — sendSellerMessageTo reports failure by returning false so a
    // caller's loop is never aborted, which means `await` completing proves
    // nothing about delivery.
    let sentToTelegram = false
    if (s?.chat) {
      sentToTelegram = await sendSellerMessageTo(s.chat, s.lang, () => message, userId)
      if (!sentToTelegram) logger.warn('manual_stock_telegram_failed', { userId })
    }
    try {
      await db.insert(alerts).values({
        user_id: userId,
        type: 'stock_update',
        message,
        sent_to_telegram: sentToTelegram,
      })
    } catch (err) {
      logger.warn('manual_stock_inapp_failed', { userId, error: String(err).slice(0, 200) })
    }

    for (const f of fresh) {
      try {
        await db.insert(stockNotifyState).values({
          user_id: userId,
          sku: dedupKeyFor(f.sku),
          marketplace: f.marketplace,
          last_status: 'manual',
          last_target: f.target,
          last_available: f.target,
          last_reason: null,
        }).onConflictDoUpdate({
          target: [stockNotifyState.user_id, stockNotifyState.sku, stockNotifyState.marketplace],
          set: { last_status: 'manual', last_target: f.target, last_available: f.target, last_reason: null, updated_at: new Date() },
        })
      } catch (err) {
        logger.warn('manual_stock_dedup_write_failed', { userId, error: String(err).slice(0, 200) })
      }
    }
  } catch (err) {
    logger.warn('manual_stock_notify_failed', { userId, error: String(err).slice(0, 200) })
  }
}
