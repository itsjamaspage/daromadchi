/**
 * Cross-store stock-update notifications.
 *
 * Fires ONLY on an actual cross-store stock-UPDATE event (a real write was
 * attempted through the audited writer) — never on every sale, so a high-volume
 * seller is not spammed. Two INDEPENDENT channels, each gated by its own
 * per-user toggle (both default ON):
 *   • in-app pop-up  → a row in the `alerts` table  (notif_stock_update_inapp)
 *   • Telegram       → daromadchi_alerts_bot message (notif_stock_update_telegram)
 *
 * ONE MESSAGE PER CYCLE, grouped by the SOLD SKU. A single sync cycle can touch
 * several SKUs and write to both stores per SKU; instead of one Telegram message
 * per write (the old 6-messages-a-cycle spam), we send a SINGLE digest that
 * lists each affected SKU once with its per-store result. Only the SKUs whose
 * outcome actually CHANGED this cycle appear — a sold product, not "all
 * products". The message reports the ACTUAL API result and never claims success
 * on a failed write.
 *
 * DEDUP (notify on transition, not on state): a SKU enters the digest only when
 * THIS cycle's outcome — (status, target, reason) for one of its stores —
 * DIFFERS from the last one we notified. A persistent failure that repeats
 * unchanged every 5-min cycle (e.g. a listing whose write keeps returning the
 * same http_400) is notified ONCE, not every cycle; a cycle with nothing new
 * sends no message at all. Last-notified outcomes live in `stock_notify_state`.
 * This suppresses only NOTIFICATIONS — stock_write_log still records every
 * attempt. Best-effort: a notification failure never propagates to the caller.
 */

import { and, eq } from 'drizzle-orm'
import { db, userSettings, alerts, stockNotifyState } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegram'
import type { MarketplaceType } from '@/lib/types'

const MP_LABEL: Record<string, string> = {
  uzum: 'Uzum', yandex_market: 'Yandex Market', wildberries: 'Wildberries',
}

export interface StockUpdateEvent {
  sku: string                                   // human SKU, e.g. "JMBLK"
  targetMarketplace: MarketplaceType            // the store we wrote to
  originMarketplace: MarketplaceType | null     // where the unit sold (max-stock member)
  listed: number                                // number shown on target before the write
  target: number                                // number written
  ok: boolean                                   // true only when the write actually succeeded
  reason?: string                               // failure reason when !ok
}

function label(mp: string): string {
  return MP_LABEL[mp] ?? mp
}

// Human-readable phrasing for the technical skip/error reasons, so a failed
// line tells the seller WHAT went wrong instead of a raw code. Unknown reasons
// fall back to a compact rendering (HTTP codes) or the raw string.
const REASON_PHRASE: Record<string, string> = {
  missing_sku:       'нет идентификатора товара',
  missing_barcode:   'нет штрихкода',
  missing_warehouse: 'нет склада',
  missing_campaign:  'нет кампании',
  no_token:          'нет токена',
}

function phraseFor(reason: string): string {
  if (REASON_PHRASE[reason]) return REASON_PHRASE[reason]
  const http = reason.match(/^http_(\d+)/)
  if (http) return `ошибка API (HTTP ${http[1]})`
  return reason
}

/**
 * Build ONE combined message for the changed SKUs. Each SKU is a header line
 * naming the sold product (and where it sold), followed by one line per store
 * with its actual result. Exported for a focused, DB-free unit test.
 */
export function buildDigestMessage(groups: { sku: string; events: StockUpdateEvent[] }[]): string {
  const lines: string[] = ['📦 Остатки обновлены (продажа):']
  for (const g of groups) {
    const origin = g.events.map(e => e.originMarketplace).find(Boolean) ?? null
    const originTxt = origin ? ` (продажа на ${label(origin)})` : ''
    lines.push('')
    lines.push(`• ${g.sku}${originTxt}:`)
    for (const e of g.events) {
      if (e.ok) {
        lines.push(`   ✅ ${label(e.targetMarketplace)}: ${e.listed}→${e.target}`)
      } else {
        const why = e.reason ? ` (${phraseFor(e.reason)})` : ''
        lines.push(`   ⚠️ ${label(e.targetMarketplace)}: не обновлён${why} — обновите вручную`)
      }
    }
  }
  return lines.join('\n')
}

function fingerprint(e: StockUpdateEvent): { status: string; target: number; reason: string | null } {
  return { status: e.ok ? 'sent' : 'fail', target: e.target, reason: e.reason ?? null }
}

/**
 * Dispatch the cross-store stock-update digest for one user: ONE message per
 * cycle covering only the SKUs whose outcome changed. Best-effort — nothing
 * here throws to the caller.
 */
export async function notifyStockUpdates(userId: string, events: StockUpdateEvent[]): Promise<void> {
  if (events.length === 0) return
  try {
    const [s] = await db.select({
      chat:     userSettings.telegram_chat_id,
      inApp:    userSettings.notif_stock_update_inapp,
      telegram: userSettings.notif_stock_update_telegram,
    }).from(userSettings).where(eq(userSettings.user_id, userId))

    const inAppOn    = s?.inApp ?? true
    const telegramOn = s?.telegram ?? true
    const chat       = s?.chat ?? null

    // Both channels off → nothing to notify through; don't touch dedup state.
    if (!inAppOn && !telegramOn) return

    // Group this cycle's write events by the SOLD SKU (one section per product).
    const bySku = new Map<string, StockUpdateEvent[]>()
    for (const e of events) {
      const arr = bySku.get(e.sku)
      if (arr) arr.push(e); else bySku.set(e.sku, [e])
    }

    // Keep only the SKUs whose outcome is genuinely NEW vs the last notification
    // (any of its stores changed). An unchanged SKU is dropped entirely, so a
    // persistent failure isn't re-sent every cycle. Fail-OPEN on a read error
    // (treat as new) so a real change is never silently swallowed.
    const changed: { sku: string; events: StockUpdateEvent[] }[] = []
    for (const [sku, evs] of bySku) {
      let skuIsNew = false
      for (const e of evs) {
        const fp = fingerprint(e)
        try {
          const [prev] = await db.select({
            status: stockNotifyState.last_status,
            target: stockNotifyState.last_target,
            reason: stockNotifyState.last_reason,
          }).from(stockNotifyState).where(and(
            eq(stockNotifyState.user_id, userId),
            eq(stockNotifyState.sku, sku),
            eq(stockNotifyState.marketplace, e.targetMarketplace),
          ))
          if (!(prev && prev.status === fp.status && prev.target === fp.target && (prev.reason ?? null) === fp.reason)) {
            skuIsNew = true
          }
        } catch (err) {
          logger.warn('stock_notify_dedup_read_failed', { userId, error: String(err).slice(0, 200) })
          skuIsNew = true
        }
      }
      if (skuIsNew) changed.push({ sku, events: evs })
    }

    if (changed.length === 0) return // nothing new this cycle → no message

    // ONE combined message across both channels.
    const message = buildDigestMessage(changed)

    let sentToTelegram = false
    if (telegramOn && chat) {
      try {
        await sendTelegramMessage(chat, message)
        sentToTelegram = true
      } catch (err) {
        logger.warn('stock_notify_telegram_failed', { userId, error: String(err).slice(0, 200) })
      }
    }

    if (inAppOn) {
      try {
        await db.insert(alerts).values({
          user_id: userId,
          type: 'stock_update',
          message,
          sent_to_telegram: sentToTelegram,
        })
      } catch (err) {
        logger.warn('stock_notify_inapp_failed', { userId, error: String(err).slice(0, 200) })
      }
    }

    // Persist the outcome we just notified for every store of every included
    // SKU, so an identical repeat next cycle stays silent. Best-effort — a write
    // miss only risks a duplicate later, never a crash.
    for (const { sku, events: evs } of changed) {
      for (const e of evs) {
        const fp = fingerprint(e)
        try {
          await db.insert(stockNotifyState).values({
            user_id: userId, sku, marketplace: e.targetMarketplace,
            last_status: fp.status, last_target: fp.target, last_reason: fp.reason,
          }).onConflictDoUpdate({
            target: [stockNotifyState.user_id, stockNotifyState.sku, stockNotifyState.marketplace],
            set: { last_status: fp.status, last_target: fp.target, last_reason: fp.reason, updated_at: new Date() },
          })
        } catch (err) {
          logger.warn('stock_notify_dedup_write_failed', { userId, error: String(err).slice(0, 200) })
        }
      }
    }
  } catch (err) {
    // Notification is informational — never let it break the sync.
    logger.warn('stock_notify_failed', { userId, error: String(err).slice(0, 200) })
  }
}
