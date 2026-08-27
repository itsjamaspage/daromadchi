/**
 * Pure decision logic for the sync-freshness watchdog (scripts/sync-freshness-check.mjs).
 *
 * Kept DB-free and Telegram-free so the two decisions that matter — "is the pool
 * stale?" and "should we page an operator this tick?" — can be unit-tested
 * without a database or a network. The watchdog itself is a thin shell around
 * these two functions plus one SQL read and one Telegram POST.
 *
 * WHY A WATCHDOG AT ALL: sync is driven by the VPS crontab hitting the Next app
 * over HTTP, not by anything inside the app. On 2025-08-27 the app served a
 * broken build for 30+ minutes while PM2 reported "online" — process liveness was
 * true while WORK liveness was false, and nothing measured the difference. This
 * measures the difference: the freshest successful stock read recorded in the DB.
 */

/** Statuses the watchdog can be in on a given tick. */
export const STATUS = Object.freeze({
  /** No active, keyed shops exist — there is nothing to sync, so nothing to alarm. */
  QUIET: 'quiet',
  /** A sync completed recently enough. */
  OK: 'ok',
  /** No sync has completed within the expected window — the alarm condition. */
  STALE: 'stale',
})

/**
 * Classify pool freshness from the newest successful stock read across active shops.
 *
 * @param {object} p
 * @param {number} p.activeShops   count of is_active shops with an API key.
 * @param {number|null} p.freshestMs  MAX(stock_synced_at) epoch ms, or null if none ever synced.
 * @param {number} p.nowMs         current epoch ms.
 * @param {number} p.thresholdMs   staleness threshold (e.g. 40 min).
 * @returns {{status: string, ageMs: number|null}}
 */
export function classifyFreshness({ activeShops, freshestMs, nowMs, thresholdMs }) {
  if (!activeShops || activeShops <= 0) return { status: STATUS.QUIET, ageMs: null }
  // Never synced but shops exist → treat as stale (age is effectively infinite),
  // but report ageMs null so the message can say "no sync on record" rather than
  // a misleading duration.
  if (freshestMs == null) return { status: STATUS.STALE, ageMs: null }
  const ageMs = nowMs - freshestMs
  return { status: ageMs >= thresholdMs ? STATUS.STALE : STATUS.OK, ageMs }
}

/**
 * Decide whether this tick should notify, given the previous persisted state.
 *
 * Rules:
 *   • enter STALE (prev not stale)        → 'alert'    (page once on the edge)
 *   • still STALE, last page ≥ reAlertMs  → 'alert'    (re-page hourly, not every tick)
 *   • still STALE, last page < reAlertMs  →  null      (already paged, stay quiet)
 *   • STALE → OK                          → 'recovery' (tell them it came back)
 *   • OK/QUIET with no prior stale        →  null
 *
 * @param {object} p
 * @param {{status?: string, lastNotifiedMs?: number|null}} p.prev  persisted prior state ({} on first run).
 * @param {string} p.currStatus   STATUS.* for this tick.
 * @param {number} p.nowMs        current epoch ms.
 * @param {number} p.reAlertMs    minimum gap between repeat pages while stale.
 * @returns {{notify: 'alert'|'recovery'|null, nextState: {status: string, lastNotifiedMs: number|null}}}
 */
export function decideNotification({ prev, currStatus, nowMs, reAlertMs }) {
  const prevStatus = prev?.status
  const prevLast = prev?.lastNotifiedMs ?? null

  let notify = null
  if (currStatus === STATUS.STALE) {
    if (prevStatus !== STATUS.STALE) {
      notify = 'alert'
    } else if (prevLast == null || nowMs - prevLast >= reAlertMs) {
      notify = 'alert'
    }
  } else if (currStatus === STATUS.OK) {
    if (prevStatus === STATUS.STALE) notify = 'recovery'
  }
  // QUIET never notifies.

  const lastNotifiedMs = notify ? nowMs : prevLast
  return { notify, nextState: { status: currStatus, lastNotifiedMs } }
}

/** Human-readable duration for log lines and messages. */
export function fmtAge(ageMs) {
  if (ageMs == null) return 'no sync on record'
  const min = Math.floor(ageMs / 60000)
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  return `${h}h${String(min % 60).padStart(2, '0')}m`
}
