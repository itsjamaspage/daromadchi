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
 * The message reports the ACTUAL API result — a successful write says "updated
 * 2→1", a failed one says "FAILED, update manually". It never claims success on
 * a failed write. Best-effort: a notification failure never propagates to the
 * caller or blocks the primary sync.
 */

import { eq } from 'drizzle-orm'
import { db, userSettings, alerts } from '@/lib/db'
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

// Human-readable phrasing for the technical skip/error reasons, so a "skipped"
// notification tells the seller WHAT to fix instead of a raw code. Unknown
// reasons fall back to the raw string.
const REASON_PHRASE: Record<string, string> = {
  missing_sku:       'нет идентификатора товара',
  missing_barcode:   'нет штрихкода',
  missing_warehouse: 'нет склада',
  missing_campaign:  'нет кампании',
  no_token:          'нет токена',
}

function buildMessage(e: StockUpdateEvent): string {
  const store = label(e.targetMarketplace)
  if (e.ok) {
    const origin = e.originMarketplace ? ` (продажа на ${label(e.originMarketplace)})` : ''
    return `✅ ${e.sku}${origin}: остаток на ${store} обновлён ${e.listed}→${e.target}.`
  }
  const why = e.reason ? ` (${REASON_PHRASE[e.reason] ?? e.reason})` : ''
  return `⚠️ ${e.sku}: остаток на ${store} НЕ обновлён${why}. Обновите вручную.`
}

/**
 * Dispatch stock-update notifications for one user. Best-effort per channel and
 * per event — nothing here throws to the caller.
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

    for (const e of events) {
      const message = buildMessage(e)

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
    }
  } catch (err) {
    // Notification is informational — never let it break the sync.
    logger.warn('stock_notify_failed', { userId, error: String(err).slice(0, 200) })
  }
}
