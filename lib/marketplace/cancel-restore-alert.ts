/**
 * Read-only "restore your listing after cancel" alert (Part 2) — DB dispatch.
 *
 * When a seller on READ-ONLY keys cancels an order, Uzum/Yandex do not put the
 * unit back on the listing: it's physically on the shelf but unsellable, and
 * sellers forget this constantly. This tells them — with the exact number to
 * restore the listing to (the reservation-time physical_stock snapshot).
 *
 * Never writes to a marketplace: this exists precisely for connections that don't
 * grant writes. It only reads and sends a Telegram / in-app message.
 *
 * GATED OFF by default. CANCEL_RESTORE_ALERT_ENABLED must be truthy to fire — and
 * it MUST stay off until the physical_stock pool feedback-loop (verified on
 * KBWHT: a stock_sync sale adopted the pool 2 → 1) is fixed, or the snapshot it
 * names is a corrupted restore target.
 */

import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm'
import { db, shops, orders, orderItems, products, userSettings, alerts } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendSellerMessageTo } from '@/lib/telegram-seller'
import { normalizeLang } from '@/lib/notif-i18n'
import { planRestoreAlerts, buildRestoreMessage, type RestoreCandidate } from '@/lib/marketplace/cancel-restore-pure'
import type { MarketplaceType } from '@/lib/types'

// Kill-switch. OFF unless explicitly enabled. Keep OFF until the pool is sound.
export function cancelRestoreAlertEnabled(): boolean {
  const v = (process.env.CANCEL_RESTORE_ALERT_ENABLED ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * Dispatch the read-only cancel-restore alert for one user. Best-effort — never
 * throws to the caller. Batches this window's eligible cancellations into one
 * message per (marketplace, variant), and marks every included order so it never
 * alerts twice (survives restarts / re-syncs via orders.restore_alert_sent_at).
 */
export async function notifyCancelRestore(userId: string): Promise<void> {
  if (!cancelRestoreAlertEnabled()) return
  try {
    // Eligible: a cancelled order on a READ-ONLY connection (edit-capable →
    // silent, gated per shop), with a reservation-time snapshot (never-reserved /
    // multi-item → snapshot NULL → excluded here), not yet alerted. Join the
    // product for the CURRENT listing (after) and the item for the ordered qty.
    const rows = await db.select({
      orderRowId:  orders.id,
      orderId:     orders.order_id_external,
      marketplace: shops.marketplace,
      sku:         products.sku,
      name:        products.title,
      before:      orders.reserved_stock_snapshot,
      after:       products.stock_quantity,
      qty:         orderItems.quantity,
    }).from(orders)
      .innerJoin(shops, eq(shops.id, orders.shop_id))
      .innerJoin(orderItems, eq(orderItems.order_id, orders.id))
      .innerJoin(products, eq(products.id, orderItems.product_id))
      .where(and(
        eq(shops.user_id, userId),
        eq(shops.api_mode, 'read_only'),
        eq(orders.status, 'cancelled'),
        isNotNull(orders.reserved_stock_snapshot),
        isNull(orders.restore_alert_sent_at),
      ))
    if (rows.length === 0) return

    // One candidate per order (a single-item order yields one row; dedup defends
    // against any stray multi-row join).
    const byOrder = new Map<string, RestoreCandidate>()
    const rowIdByOrder = new Map<string, string>()
    for (const r of rows) {
      const orderId = r.orderId ?? r.orderRowId
      if (byOrder.has(orderId)) continue
      byOrder.set(orderId, {
        orderId,
        marketplace: r.marketplace as MarketplaceType,
        sku: r.sku ?? '',
        name: (r.name ?? '').trim(),
        before: r.before ?? 0,
        after: r.after ?? 0,
        qty: r.qty ?? 1,
      })
      rowIdByOrder.set(orderId, r.orderRowId)
    }

    const { groups } = planRestoreAlerts([...byOrder.values()])

    const [s] = await db.select({ chat: userSettings.telegram_chat_id, lang: userSettings.notif_lang })
      .from(userSettings).where(eq(userSettings.user_id, userId))
    const lang = normalizeLang(s?.lang)

    for (const g of groups) {
      const message = buildRestoreMessage(g, lang)
      let sentTg = false
      if (s?.chat) {
        sentTg = await sendSellerMessageTo(s.chat, s?.lang, () => message, userId)
        if (!sentTg) logger.warn('cancel_restore_telegram_failed', { userId })
      }
      try {
        await db.insert(alerts).values({ user_id: userId, type: 'stock_restore', message, sent_to_telegram: sentTg })
      } catch (err) {
        logger.warn('cancel_restore_inapp_failed', { userId, error: String(err).slice(0, 200) })
      }
    }

    // At-most-once: stamp every order we just alerted about (best-effort).
    const rowIds = [...new Set([...rowIdByOrder.values()])]
    if (rowIds.length > 0) {
      await db.update(orders).set({ restore_alert_sent_at: new Date() }).where(inArray(orders.id, rowIds))
    }
  } catch (err) {
    logger.warn('cancel_restore_notify_failed', { userId, error: String(err).slice(0, 200) })
  }
}
