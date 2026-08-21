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
import { notifT, normalizeLang, type NotifLang } from '@/lib/notif-i18n'
import { COLOR_LABELS } from '@/lib/products/resolveColor'
import type { MarketplaceType } from '@/lib/types'

const MP_LABEL: Record<string, string> = {
  uzum: 'Uzum', yandex_market: 'Yandex Market',
}

export interface StockUpdateEvent {
  sku: string                                   // human SKU, e.g. "JMBLK"
  targetMarketplace: MarketplaceType            // the store we wrote to
  originMarketplace: MarketplaceType | null     // where the unit sold (max-stock member)
  listed: number                                // number shown on target before the write
  target: number                                // number written
  ok: boolean                                   // true only when the write actually succeeded
  reason?: string                               // failure reason when !ok
  available: number                             // GROUP free-to-sell after the update (shared pool)
  // Product identity for the header line (all optional — a group with none still
  // renders the SKU alone). Same physical product across the group, so one set.
  name?: string | null                          // products.title — full product name
  colorKey?: string | null                      // products.variant_color — resolved key
  price?: number | null                         // products.selling_price (UZS)
}

function label(mp: string): string {
  return MP_LABEL[mp] ?? mp
}

// Localize a resolved colour key. Unknown keys are omitted rather than shown raw.
function colorLabel(key: string | null | undefined, lang: NotifLang): string | null {
  if (!key) return null
  return (COLOR_LABELS as Record<string, Record<string, string>>)[key]?.[lang] ?? null
}

// "450000" → "450 000" (space-grouped thousands).
function fmtSum(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Build ONE combined message for the changed SKUs. Each SKU is a header line
 * naming the sold product (and where it sold), followed by one line per store
 * with its actual result. Exported for a focused, DB-free unit test.
 */
export function buildDigestMessage(
  groups: { sku: string; events: StockUpdateEvent[] }[],
  lang: NotifLang = 'uz',
): string {
  const T = notifT(lang)
  const lines: string[] = [T.stockSyncTitle]
  for (const g of groups) {
    const origin = g.events.map(e => e.originMarketplace).find(Boolean) ?? null
    const originTxt = origin ? T.stockSyncSoldOn(label(origin)) : ''
    // All events in a group are the same physical product → take identity once.
    const first = g.events[0]
    const name  = first?.name?.trim() || null
    const color = colorLabel(first?.colorKey, lang)
    const price = first?.price != null && first.price > 0 ? `${fmtSum(first.price)} ${T.som}` : null
    // • <SKU> — <name> · <color> · <price> сум (продажа на <origin>):
    const meta = [name, color, price].filter(Boolean).join(' · ')
    const metaTxt = meta ? ` — ${meta}` : ''
    lines.push('')
    lines.push(`• ${g.sku}${metaTxt}${originTxt}:`)
    for (const e of g.events) {
      if (e.ok) {
        lines.push(T.stockSyncOk(label(e.targetMarketplace), e.listed, e.target))
      } else {
        const why = e.reason ? ` (${T.stockSyncReason(e.reason)})` : ''
        lines.push(T.stockSyncFailed(label(e.targetMarketplace), why))
      }
    }
    // Restock warning on the GROUP's shared free-to-sell (not per-marketplace):
    // fires whenever the post-update pool is below 5 (4 or fewer). The dispatcher
    // never dedups a group whose available < 5, so this sends on every such sale.
    const groupAvailable = first?.available
    if (typeof groupAvailable === 'number' && groupAvailable < RESTOCK_THRESHOLD) {
      lines.push(T.stockSyncRestock(groupAvailable))
    }
  }
  return lines.join('\n')
}

// Below this shared free-to-sell the digest carries the "⚠️ Осталось N" restock
// line. It is NOT a dedup bypass: the line rides the normal (target, available)
// dedup via `available` being part of the fingerprint, so it resends whenever the
// pool genuinely moves but not on a duplicate trigger for the SAME sale.
const RESTOCK_THRESHOLD = 5

// How long an identical digest is treated as a duplicate. One physical sale fans
// out to TWO sync triggers (the Yandex webhook AND the 5-min cron), seconds
// apart, producing the SAME (status, target, available) for the SAME SKU — this
// window collapses that twin into one message. A genuine new sale changes
// `available` (a new key → sends), and the same state recurring AFTER the window
// (a later, separate sellout) also sends again.
const DEDUP_WINDOW_MS = 10 * 60 * 1000

export interface NotifyFingerprint {
  status: string
  target: number
  available: number
  reason: string | null
}

export function fingerprintOf(e: StockUpdateEvent): NotifyFingerprint {
  return {
    status: e.ok ? 'sent' : 'fail',
    target: e.target,
    available: typeof e.available === 'number' ? e.available : -1,
    reason: e.reason ?? null,
  }
}

/**
 * Decide whether one SKU's events are a RECENT DUPLICATE that should be
 * suppressed. Pure — the caller supplies the last-notified fingerprint (and its
 * age in ms) per target marketplace, read from stock_notify_state.
 *
 * Suppress ONLY when EVERY event matches a stored fingerprint whose age is within
 * DEDUP_WINDOW_MS. If any event is new (different status/target/available/reason)
 * OR its match is older than the window, the SKU is sent. This collapses the
 * webhook+cron twin while still notifying on a real change or a later recurrence.
 */
export function isRecentDuplicate(
  events: StockUpdateEvent[],
  priorByMarketplace: Map<string, { fp: NotifyFingerprint; ageMs: number }>,
  windowMs: number = DEDUP_WINDOW_MS,
): boolean {
  if (events.length === 0) return true
  return events.every(e => {
    const prior = priorByMarketplace.get(e.targetMarketplace)
    if (!prior) return false
    if (prior.ageMs > windowMs) return false
    const fp = fingerprintOf(e)
    return prior.fp.status === fp.status
      && prior.fp.target === fp.target
      && prior.fp.available === fp.available
      && (prior.fp.reason ?? null) === fp.reason
  })
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
      lang:     userSettings.notif_lang,
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

    // Keep only the SKUs whose outcome is genuinely NEW — not a RECENT DUPLICATE.
    // A single physical sale fans out to two triggers (Yandex webhook + 5-min
    // cron) producing an identical (status, target, available) digest seconds
    // apart; those are collapsed to ONE message. An unchanged SKU whose last
    // notification is within the window is dropped; a real change (new available/
    // target) or the same state recurring AFTER the window still sends. The
    // restock line rides this same key (available is in the fingerprint) — it is
    // NOT a dedup bypass. Fail-OPEN on a read error (treat as new) so a real
    // change is never silently swallowed.
    const now = Date.now()
    const changed: { sku: string; events: StockUpdateEvent[] }[] = []
    for (const [sku, evs] of bySku) {
      const priorByMarketplace = new Map<string, { fp: NotifyFingerprint; ageMs: number }>()
      let readFailed = false
      for (const e of evs) {
        try {
          const [prev] = await db.select({
            status: stockNotifyState.last_status,
            target: stockNotifyState.last_target,
            available: stockNotifyState.last_available,
            reason: stockNotifyState.last_reason,
            updatedAt: stockNotifyState.updated_at,
          }).from(stockNotifyState).where(and(
            eq(stockNotifyState.user_id, userId),
            eq(stockNotifyState.sku, sku),
            eq(stockNotifyState.marketplace, e.targetMarketplace),
          ))
          if (prev) {
            priorByMarketplace.set(e.targetMarketplace, {
              fp: {
                status: prev.status ?? '',
                target: prev.target ?? -1,
                available: prev.available ?? -1,
                reason: prev.reason ?? null,
              },
              ageMs: prev.updatedAt ? now - new Date(prev.updatedAt).getTime() : Number.POSITIVE_INFINITY,
            })
          }
        } catch (err) {
          logger.warn('stock_notify_dedup_read_failed', { userId, error: String(err).slice(0, 200) })
          readFailed = true
        }
      }
      // Fail-open on a read error; otherwise suppress only a recent duplicate.
      if (readFailed || !isRecentDuplicate(evs, priorByMarketplace)) {
        changed.push({ sku, events: evs })
      }
    }

    if (changed.length === 0) return // nothing new this cycle → no message

    // ONE combined message across both channels.
    const message = buildDigestMessage(changed, normalizeLang(s?.lang))

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
        const fp = fingerprintOf(e)
        try {
          await db.insert(stockNotifyState).values({
            user_id: userId, sku, marketplace: e.targetMarketplace,
            last_status: fp.status, last_target: fp.target, last_available: fp.available, last_reason: fp.reason,
          }).onConflictDoUpdate({
            target: [stockNotifyState.user_id, stockNotifyState.sku, stockNotifyState.marketplace],
            set: { last_status: fp.status, last_target: fp.target, last_available: fp.available, last_reason: fp.reason, updated_at: new Date() },
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
