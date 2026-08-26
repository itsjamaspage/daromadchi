/**
 * Read-only "update your stock manually" reminder.
 *
 * The READ-ONLY counterpart of the edit-mode cross-store stock sync. A seller on
 * read-only keys never lets Daromadchi write to a marketplace — so when a linked
 * cross-marketplace SKU goes out of sync (Uzum sells the last unit → 0, but the
 * linked Yandex listing still shows 1), instead of WRITING the corrected number
 * we TELL the seller the exact number to set by hand: "• JMWHT — set 0 on Yandex".
 *
 * SAFETY: this module never writes to any marketplace. It imports only read /
 * compute helpers (computeAvailable, reservingOrderCondition) and the notifier —
 * NOT stock-writer / pushStock / order-cancel. There is no reachable write path.
 *
 * Target number = computeAvailable(group members) — exact parity with the number
 * edit-mode would have written (mirror-always: the shared free-to-sell applies to
 * every listing). Fires only for LINKED CROSS-MARKETPLACE groups (members on ≥2
 * marketplaces); a single-marketplace seller has nothing to reconcile. Gated by
 * the dedicated per-user toggle notif_stock_manual (default ON), independent of
 * the edit-mode notif_stock_update_* toggles and NOT behind any paid plan.
 *
 * DEDUP: reuses stock_notify_state, keyed (user, sku, marketplace), with a
 * 'manual' status marker so these rows are distinguishable from edit-mode rows.
 * A reminder fires once per divergence VALUE (target) and stays silent while it
 * is unchanged, so a still-out-of-sync listing does not re-alert every cycle.
 */

import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, userSettings, alerts, stockNotifyState } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendSellerMessageTo } from '@/lib/telegram-seller'
import { normalizeLang } from '@/lib/notif-i18n'
import type { SyncMember } from '@/lib/marketplace/stock-allocation'
import type { MarketplaceType } from '@/lib/types'
import { normalizeKey } from '@/lib/db/stock-groups'
import { reservingOrderCondition } from '@/lib/marketplace/reserving-orders'
import {
  computeManualReminders, shouldRemind, buildManualMessage, MANUAL_STATUS,
  type ManualReminder, type GroupIdentity,
} from '@/lib/marketplace/manual-stock-pure'

// Load this user's SKU groups (all active shops, every api_mode). Mirrors the
// read side of the edit-mode loader but stays independent of it, so this feature
// can never reach a write path. Returns members bucketed by normalized SKU.
interface LoadedGroup { members: SyncMember[]; identity: GroupIdentity }

async function loadUserGroups(userId: string): Promise<Map<string, LoadedGroup>> {
  const shopRows = await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_mode: shops.api_mode,
    priority: shops.primary_channel_priority,
  }).from(shops).where(and(eq(shops.user_id, userId), eq(shops.is_active, true)))

  const inScope = shopRows.filter(s => s.marketplace === 'uzum' || s.marketplace === 'yandex_market')
  const shopById = new Map(inScope.map(s => [s.id, s]))
  const shopIds = [...shopById.keys()]
  const groups = new Map<string, LoadedGroup>()
  if (shopIds.length === 0) return groups

  const [prodRows, pendingRows] = await Promise.all([
    db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      stock_quantity: products.stock_quantity,
      physical_stock: products.physical_stock,
      // Identity for the message. Same products row — no extra join.
      title: products.title,
      variant_color: products.variant_color,
    }).from(products).where(inArray(products.shop_id, shopIds)),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(inArray(orders.shop_id, shopIds), reservingOrderCondition()))
      .groupBy(orderItems.product_id),
  ])

  const pendingByProduct = new Map(pendingRows.map(r => [r.product_id, Number(r.qty)]))

  // The order to name in the message. Deliberately NOT filtered by
  // reservingOrderCondition(): a listing can be out of sync precisely because a
  // sale failed to register as reserving, and in that case the reserving filter
  // would return nothing — hiding the order number in exactly the case the
  // seller most needs it. So: the most recent order on this product that was not
  // cancelled or returned, which is what "the sale that moved this group" means
  // to a seller. Absent (no orders yet) simply omits the clause.
  const latestOrderRows = shopIds.length === 0 ? [] : await db.select({
    product_id: orderItems.product_id,
    order_id_external: orders.order_id_external,
    // Which marketplace the sale came from. That side maintains its own listing
    // once the order is accepted for shipping, so it is excluded from the
    // reminder — see GroupIdentity.orderMarketplace in manual-stock-pure.ts.
    marketplace: orders.marketplace,
    ordered_at: orders.ordered_at,
  }).from(orderItems)
    .innerJoin(orders, eq(orderItems.order_id, orders.id))
    .where(and(
      inArray(orders.shop_id, shopIds),
      notInArray(orders.status, ['cancelled', 'returned']),
    ))
    .orderBy(desc(orders.ordered_at))

  const latestOrderByProduct = new Map<string, { id: string; marketplace: MarketplaceType }>()
  for (const r of latestOrderRows) {
    if (!r.product_id || !r.order_id_external) continue
    if (!latestOrderByProduct.has(r.product_id)) {
      latestOrderByProduct.set(r.product_id, {
        id: r.order_id_external,
        marketplace: r.marketplace as MarketplaceType,
      })
    }
  }

  for (const p of prodRows) {
    const shop = shopById.get(p.shop_id)
    if (!shop) continue
    const key = p.sku ? normalizeKey(p.sku) : `#${p.id}`
    const member: SyncMember = {
      productId: p.id,
      shopId: p.shop_id,
      marketplace: shop.marketplace,
      apiMode: shop.api_mode,
      priority: shop.priority,
      listedStock: p.stock_quantity,
      physicalStock: p.physical_stock,
      pending: pendingByProduct.get(p.id) ?? 0,
      sku: p.sku,
    }
    let g = groups.get(key)
    if (!g) { g = { members: [], identity: {} }; groups.set(key, g) }
    g.members.push(member)
    // First non-empty wins — every member of a group is the same physical
    // product, so any of them can supply the name and colour.
    if (!g.identity.title && p.title) g.identity.title = p.title
    if (!g.identity.colorKey && p.variant_color) g.identity.colorKey = p.variant_color
    if (!g.identity.orderId) {
      const latest = latestOrderByProduct.get(p.id)
      if (latest) {
        g.identity.orderId = latest.id
        g.identity.orderMarketplace = latest.marketplace
      }
    }
  }
  return groups
}

/**
 * Dispatch the read-only manual-stock reminder for one user. Best-effort — never
 * throws to the caller (a reminder must not break the sync). Sends ONE grouped
 * message covering every out-of-sync read-only listing whose target changed since
 * the last reminder. Never writes to a marketplace.
 */
export async function notifyManualStockUpdates(userId: string): Promise<void> {
  try {
    const [s] = await db.select({
      chat:    userSettings.telegram_chat_id,
      enabled: userSettings.notif_stock_manual,
      lang:    userSettings.notif_lang,
    }).from(userSettings).where(eq(userSettings.user_id, userId))

    // Dedicated toggle, default ON. Off → nothing (neither channel).
    if (s && s.enabled === false) return

    const groups = await loadUserGroups(userId)
    const candidates: ManualReminder[] = []
    for (const g of groups.values()) candidates.push(...computeManualReminders(g.members, g.identity))
    if (candidates.length === 0) return

    // DEDUP: keep only listings whose target changed since the last manual
    // reminder. Fail-OPEN on a read error (treat as new) so a real divergence is
    // never silently swallowed.
    const toSend: ManualReminder[] = []
    for (const it of candidates) {
      try {
        const [prev] = await db.select({
          status: stockNotifyState.last_status,
          target: stockNotifyState.last_target,
        }).from(stockNotifyState).where(and(
          eq(stockNotifyState.user_id, userId),
          eq(stockNotifyState.sku, it.sku),
          eq(stockNotifyState.marketplace, it.marketplace),
        ))
        if (shouldRemind(prev ?? null, it.target)) toSend.push(it)
      } catch (err) {
        logger.warn('manual_stock_dedup_read_failed', { userId, error: String(err).slice(0, 200) })
        toSend.push(it)
      }
    }
    if (toSend.length === 0) return

    const lang = normalizeLang(s?.lang)
    const message = buildManualMessage(toSend, lang)

    let sentToTelegram = false
    if (s?.chat) {
      sentToTelegram = await sendSellerMessageTo(s.chat, s?.lang, () => message, userId)
      if (!sentToTelegram) logger.warn('manual_stock_telegram_failed', { userId })
    }

    try {
      await db.insert(alerts).values({
        user_id: userId,
        type: 'stock_manual',
        message,
        sent_to_telegram: sentToTelegram,
      })
    } catch (err) {
      logger.warn('manual_stock_inapp_failed', { userId, error: String(err).slice(0, 200) })
    }

    // Record the target we just reminded about, so an unchanged divergence stays
    // silent next cycle. status='manual' marks the row as ours.
    for (const it of toSend) {
      try {
        await db.insert(stockNotifyState).values({
          user_id: userId, sku: it.sku, marketplace: it.marketplace,
          last_status: MANUAL_STATUS, last_target: it.target, last_available: it.target, last_reason: null,
        }).onConflictDoUpdate({
          target: [stockNotifyState.user_id, stockNotifyState.sku, stockNotifyState.marketplace],
          set: { last_status: MANUAL_STATUS, last_target: it.target, last_available: it.target, last_reason: null, updated_at: new Date() },
        })
      } catch (err) {
        logger.warn('manual_stock_dedup_write_failed', { userId, error: String(err).slice(0, 200) })
      }
    }
  } catch (err) {
    logger.warn('manual_stock_notify_failed', { userId, error: String(err).slice(0, 200) })
  }
}
