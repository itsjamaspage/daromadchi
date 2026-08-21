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
import { db, shops, orders, orderItems, userSettings, orderCancelLog, oversellNotifyState } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegram'
import { notifT, normalizeLang, type NotifLang, type NotifStrings } from '@/lib/notif-i18n'
import { cancelOrder } from '@/lib/marketplace/order-cancel'
import { reservingOrderCondition } from '@/lib/marketplace/reserving-orders'
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

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex Market' }

async function telegramTarget(userId: string): Promise<{ chat: string; lang: NotifLang } | null> {
  const [s] = await db.select({ chat: userSettings.telegram_chat_id, lang: userSettings.notif_lang })
    .from(userSettings).where(eq(userSettings.user_id, userId))
  return s?.chat ? { chat: s.chat, lang: normalizeLang(s.lang) } : null
}

/**
 * Send an oversell alert, composed in the seller's own language.
 *
 * The callers pass a builder rather than a finished string: the alert body is
 * localised, so it cannot be assembled until the language is known, and the
 * language is only known here. Handing this function a plain string is what let
 * these messages sit in English for every seller.
 */
async function alert(userId: string, build: (T: NotifStrings) => string): Promise<void> {
  const target = await telegramTarget(userId)
  if (!target) { logger.warn('oversell_alert_no_chat', { userId }); return }
  try { await sendTelegramMessage(target.chat, build(notifT(target.lang))) }
  catch (e) { logger.warn('oversell_alert_failed', { userId, error: String(e).slice(0, 200) }) }
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

// Pure DEDUP decision: is THIS oversell the same situation we already alerted
// about? Same later order AND same oversold amount = a duplicate → suppress. A
// new later order or a deeper oversold count is a distinct situation → alert.
// Exported for a focused, DB-free test.
export function isDuplicateOversell(
  prev: { orderExt: string | null; oversoldBy: number | null } | null | undefined,
  cur: { orderExt: string | null; oversoldBy: number },
): boolean {
  return !!prev
    && (prev.orderExt ?? null) === (cur.orderExt ?? null)
    && (prev.oversoldBy ?? null) === cur.oversoldBy
}

// Load the last-alerted oversell fingerprint for (user, match_key). Best-effort:
// a read failure returns null → the caller FAILS OPEN (alerts), so a real
// oversell is never silently swallowed by a transient DB error.
async function lastOversellAlert(userId: string, matchKey: string): Promise<{ orderExt: string | null; oversoldBy: number | null } | null> {
  try {
    const [prev] = await db.select({
      orderExt: oversellNotifyState.last_order_ext,
      oversoldBy: oversellNotifyState.last_oversold_by,
    }).from(oversellNotifyState).where(and(
      eq(oversellNotifyState.user_id, userId),
      eq(oversellNotifyState.match_key, matchKey),
    ))
    return prev ?? null
  } catch (err) {
    logger.warn('oversell_dedup_read_failed', { userId, error: String(err).slice(0, 200) })
    return null
  }
}

// Persist the oversell we just alerted about, so an identical repeat next cycle
// stays silent. Best-effort — a miss only risks one duplicate later, never a crash.
async function recordOversellAlert(userId: string, matchKey: string, orderExt: string | null, oversoldBy: number): Promise<void> {
  try {
    await db.insert(oversellNotifyState).values({
      user_id: userId, match_key: matchKey, last_order_ext: orderExt, last_oversold_by: oversoldBy, updated_at: new Date(),
    }).onConflictDoUpdate({
      target: [oversellNotifyState.user_id, oversellNotifyState.match_key],
      set: { last_order_ext: orderExt, last_oversold_by: oversoldBy, updated_at: new Date() },
    })
  } catch (err) {
    logger.warn('oversell_dedup_write_failed', { userId, error: String(err).slice(0, 200) })
  }
}

export type OversellAction = 'alert_only' | 'auto_cancelled' | 'rate_limited' | 'no_later_order' | 'auto_disabled' | 'suppressed_duplicate'

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
        // Cancel among the SAME set that reserves stock (PVZ has received the
        // unit and later), so detection and resolution stay coherent. Shared
        // condition, see reservingOrderCondition / RESERVING_RAW_STATUSES.
        .where(and(inArray(orderItems.product_id, g.productIds), reservingOrderCondition()))
        .orderBy(desc(orders.ordered_at))
        .limit(1)
    : []

  const laterLabel = later
    ? `${MP_LABEL[later.marketplace] ?? later.marketplace} #${later.orderIdExternal ?? later.orderId}`
    : '—'
  const head = `⚠️ <b>Oversell</b>: <b>${g.title}</b>\nSold ${oversoldBy} more than in stock. Latest order: ${laterLabel}.`

  // DEDUP: fire ONCE per distinct oversell situation, not every reconcile cycle.
  // An unresolved oversell recurs every 5-min sync; without this the seller gets
  // the same «⚠️ Oversell» alert indefinitely (141 identical messages). We
  // fingerprint on the later order + oversold amount: a NEW later order or a
  // DEEPER oversell re-alerts; the same unchanged situation stays silent. This
  // gates the whole handler — the auto-cancel action path also stops re-attacking
  // an already-handled order every cycle. Fail-OPEN on a read miss (alert).
  const fpOrder = later?.orderIdExternal ?? later?.orderId ?? null
  const prevAlert = await lastOversellAlert(g.userId, g.matchKey)
  if (isDuplicateOversell(prevAlert, { orderExt: fpOrder, oversoldBy })) {
    return { action: 'suppressed_duplicate', oversoldBy }
  }
  // Record BEFORE alerting so a best-effort alert failure can't re-spam next cycle.
  await recordOversellAlert(g.userId, g.matchKey, fpOrder, oversoldBy)

  // 1. Always alert first.
  if (!autoCancelEnabled()) {
    await alert(g.userId, T => `${head}\n${T.oversellAutoCancelOff}`)
    return { action: 'alert_only', oversoldBy }
  }
  if (!later || !later.orderIdExternal) {
    await alert(g.userId, T => `${head}\n${T.oversellNoLaterOrder}`)
    return { action: 'no_later_order', oversoldBy }
  }

  // 2. Rate limit — escalate to a human instead of cancelling beyond the cap.
  const used = await recentAutoCancels(g.userId)
  if (used >= autoCancelMax()) {
    await alert(g.userId, T => `${head}\n${T.oversellRateLimited(used, autoCancelMax(), laterLabel)}`)
    logger.warn('oversell_autocancel_rate_limited', { userId: g.userId, used, max: autoCancelMax() })
    return { action: 'rate_limited', oversoldBy }
  }

  // 3. Alert that we are acting, THEN cancel.
  await alert(g.userId, T => `${head}\n${T.oversellCancelling(laterLabel)}`)

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
