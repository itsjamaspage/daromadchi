/**
 * Oversell detection + response.
 *
 * Detection: raw available = MAX(stock across group) − SUM(all pending) < 0 means
 * more units are on open orders than physically exist — the same unit sold twice.
 *
 * Response, in this order:
 *   1. ALWAYS fire a Telegram alert first (before/as we act) — you find out in
 *      real time, not from a log later.
 *   2. Auto-cancel is OFF by default. Even when enabled it is rate-limited: it
 *      will not auto-cancel more than N orders per rolling window without
 *      escalating to a human (an alert saying "human needed"). A detection bug
 *      that starts cancelling good orders is worse than the oversell itself.
 *   3. One-click cancel (human in the loop) always stays available via the writer.
 */

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { db, shops, orders, orderItems, userSettings, orderCancelLog } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegram'
import { cancelOrder } from '@/lib/marketplace/order-cancel'
import { STOCK_RESERVING_STATUSES } from '@/lib/marketplace/stock-allocation'
import type { MarketplaceType } from '@/lib/types'

const AUTO_CANCEL_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function autoCancelEnabled(): boolean {
  const v = (process.env.STOCK_SYNC_AUTOCANCEL ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}
function autoCancelMax(): number {
  const n = Number(process.env.STOCK_SYNC_AUTOCANCEL_MAX)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3
}

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex Market', wildberries: 'Wildberries' }

async function telegramChat(userId: string): Promise<string | null> {
  const [s] = await db.select({ chat: userSettings.telegram_chat_id })
    .from(userSettings).where(eq(userSettings.user_id, userId))
  return s?.chat ?? null
}

async function alert(userId: string, text: string): Promise<void> {
  const chat = await telegramChat(userId)
  if (!chat) { logger.warn('oversell_alert_no_chat', { userId }); return }
  try { await sendTelegramMessage(chat, text) } catch (e) { logger.warn('oversell_alert_failed', { userId, error: String(e).slice(0, 200) }) }
}

// Count auto-cancels for this user in the rolling window (blast-radius limit).
async function recentAutoCancels(userId: string): Promise<number> {
  const since = new Date(Date.now() - AUTO_CANCEL_WINDOW_MS)
  const [row] = await db.select({ n: sql<number>`count(*)` })
    .from(orderCancelLog)
    .innerJoin(shops, eq(orderCancelLog.shop_id, shops.id))
    .where(and(
      eq(shops.user_id, userId),
      eq(orderCancelLog.auto, true),
      eq(orderCancelLog.status, 'sent'),
      gte(orderCancelLog.created_at, since),
    ))
  return Number(row?.n ?? 0)
}

export interface OversellGroup {
  userId: string
  matchKey: string
  title: string
  rawAvailable: number          // negative
  productIds: string[]          // all products in the group
}

export type OversellAction = 'alert_only' | 'auto_cancelled' | 'rate_limited' | 'no_later_order' | 'auto_disabled'

export interface OversellOutcome {
  action: OversellAction
  oversoldBy: number
  cancelledOrderId?: string
  cancelStatus?: string
}

/**
 * Handle a detected oversell for one SKU group. Always alerts; auto-cancels the
 * LATER order only when enabled and under the rate limit.
 */
export async function handleOversell(g: OversellGroup): Promise<OversellOutcome> {
  const oversoldBy = Math.max(0, -g.rawAvailable)

  // Find the LATER open order across the group (the one to cancel).
  const [later] = g.productIds.length
    ? await db.select({
        orderId: orders.id,
        orderIdExternal: orders.order_id_external,
        shopId: orders.shop_id,
        marketplace: orders.marketplace,
        orderedAt: orders.ordered_at,
      }).from(orders)
        .innerJoin(orderItems, eq(orderItems.order_id, orders.id))
        // Cancel among the SAME set that reserves stock (handed over / at PVZ),
        // so detection and resolution stay coherent. See STOCK_RESERVING_STATUSES.
        .where(and(inArray(orderItems.product_id, g.productIds), inArray(orders.status, [...STOCK_RESERVING_STATUSES])))
        .orderBy(desc(orders.ordered_at))
        .limit(1)
    : []

  const laterLabel = later
    ? `${MP_LABEL[later.marketplace] ?? later.marketplace} #${later.orderIdExternal ?? later.orderId}`
    : '—'
  const head = `⚠️ <b>Oversell</b>: <b>${g.title}</b>\nSold ${oversoldBy} more than in stock. Latest order: ${laterLabel}.`

  // 1. Always alert first.
  if (!autoCancelEnabled()) {
    await alert(g.userId, `${head}\nAuto-cancel is OFF — cancel the later order manually if needed.`)
    return { action: 'alert_only', oversoldBy }
  }
  if (!later || !later.orderIdExternal) {
    await alert(g.userId, `${head}\nNo open order found to auto-cancel — please check manually.`)
    return { action: 'no_later_order', oversoldBy }
  }

  // 2. Rate limit — escalate to a human instead of cancelling beyond the cap.
  const used = await recentAutoCancels(g.userId)
  if (used >= autoCancelMax()) {
    await alert(g.userId, `${head}\n🚫 Auto-cancel rate limit reached (${used}/${autoCancelMax()} this hour). NOT auto-cancelling — human needed. Use one-click cancel for ${laterLabel}.`)
    logger.warn('oversell_autocancel_rate_limited', { userId: g.userId, used, max: autoCancelMax() })
    return { action: 'rate_limited', oversoldBy }
  }

  // 3. Alert that we are acting, THEN cancel.
  await alert(g.userId, `${head}\n🤖 Auto-cancelling the later order (${laterLabel}, reason OUT_OF_STOCK).`)

  const [shop] = await db.select({
    id: shops.id, marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted, shop_id_external: shops.shop_id_external,
    stock_sync_dry_run: shops.stock_sync_dry_run,
  }).from(shops).where(eq(shops.id, later.shopId))
  if (!shop) return { action: 'no_later_order', oversoldBy }

  const res = await cancelOrder({
    shop: { id: shop.id, marketplace: shop.marketplace as MarketplaceType, api_key_encrypted: shop.api_key_encrypted, shop_id_external: shop.shop_id_external },
    orderIdExternal: later.orderIdExternal,
    reason: 'OUT_OF_STOCK',
    // Order-cancel keeps its OWN independent safety: env flag STOCK_SYNC_AUTOCANCEL
    // (off by default) + rate limit + this per-shop simulate gate. Stock writes
    // are always live now, but auto-cancelling a customer's order stays gated.
    dryRun: shop.stock_sync_dry_run,
    auto: true,
  })

  logger.info('oversell_autocancel', { userId: g.userId, matchKey: g.matchKey, order: later.orderIdExternal, status: res.status })
  return { action: 'auto_cancelled', oversoldBy, cancelledOrderId: later.orderIdExternal, cancelStatus: res.status }
}
