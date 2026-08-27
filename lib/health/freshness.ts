/**
 * Is the sync still running? Pure decision, no I/O, so it is unit-testable.
 *
 * WHY THIS EXISTS
 * On 27 Aug the sync cron did nothing for 40 minutes and every signal we had
 * said the app was fine: pm2 reported "online", /api/health returned 200, and
 * the CI health check went green. The process was up; the work had stopped. We
 * were measuring liveness and calling it health.
 *
 * WHICH CLOCK, AND WHY IT MATTERS
 * `shops.stock_synced_at` — refreshed every 15 minutes and NOT plan-gated
 * (STOCK_REFRESH_MS in app/api/cron/sync/route.ts).
 *
 * NOT `shops.last_synced_at`: that only advances on a HEAVY pass, and those run
 * every 6h on free, 2h on pro, 30min on pro_plus. A 40-minute threshold against
 * it would fire constantly for most accounts — and an alert that cries wolf is
 * worse than none, because it trains you to ignore the one that matters. It is
 * reported as detail, never as a trigger.
 *
 * NOT stock_write_log either: rows appear only for stock_sync shops, so a purely
 * read-only account would look permanently dead.
 */

/** Two missed 15-minute ticks, with room for a slow one. */
export const FRESHNESS_THRESHOLD_MINUTES = 40

export interface FreshnessInput {
  /** Active shops holding a token — the ones that SHOULD be syncing. */
  activeShops: number
  /** Newest shops.stock_synced_at across them, or null if none ever synced. */
  newestStockSyncedAt: Date | null
  now: Date
}

export type FreshnessState = 'ok' | 'stale' | 'never_synced' | 'nothing_to_sync'

export interface FreshnessResult {
  ok: boolean
  state: FreshnessState
  staleMinutes: number | null
  thresholdMinutes: number
}

export function assessFreshness(input: FreshnessInput): FreshnessResult {
  const thresholdMinutes = FRESHNESS_THRESHOLD_MINUTES

  // No shops to sync is not a failure. Alerting here would make the watchdog
  // noisy for every account that has not connected a marketplace yet, and a
  // noisy watchdog gets muted — which is the failure this is meant to prevent.
  if (input.activeShops === 0) {
    return { ok: true, state: 'nothing_to_sync', staleMinutes: null, thresholdMinutes }
  }

  // Shops exist and NONE has ever synced. Not merely stale — never started.
  if (input.newestStockSyncedAt == null) {
    return { ok: false, state: 'never_synced', staleMinutes: null, thresholdMinutes }
  }

  const staleMinutes = Math.floor(
    (input.now.getTime() - input.newestStockSyncedAt.getTime()) / 60_000,
  )
  // A clock skew that puts the last sync in the future must not read as stale.
  const stale = staleMinutes > thresholdMinutes
  return {
    ok: !stale,
    state: stale ? 'stale' : 'ok',
    staleMinutes: Math.max(0, staleMinutes),
    thresholdMinutes,
  }
}
