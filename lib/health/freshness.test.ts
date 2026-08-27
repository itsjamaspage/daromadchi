import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { assessFreshness, FRESHNESS_THRESHOLD_MINUTES } from './freshness'

const NOW = new Date('2026-08-27T15:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

describe('the sync watchdog', () => {
  test('fresh: a sync inside the window is healthy', () => {
    const r = assessFreshness({ activeShops: 2, newestStockSyncedAt: minutesAgo(12), now: NOW })
    assert.equal(r.ok, true)
    assert.equal(r.state, 'ok')
    assert.equal(r.staleMinutes, 12)
  })

  test('THE INCIDENT: nothing for 40+ minutes is not healthy', () => {
    // 27 Aug: pm2 said "online", /api/health returned 200, CI went green, and
    // no sync had run since 14:23. This is the case that must not be silent.
    const r = assessFreshness({ activeShops: 2, newestStockSyncedAt: minutesAgo(41), now: NOW })
    assert.equal(r.ok, false)
    assert.equal(r.state, 'stale')
    assert.equal(r.staleMinutes, 41)
  })

  test('the boundary is inclusive — exactly 40 is still fine', () => {
    // Stock refreshes every 15 min, so 40 allows two missed ticks plus a slow
    // one. Alerting AT the threshold would fire on a merely unlucky run.
    assert.equal(assessFreshness({ activeShops: 1, newestStockSyncedAt: minutesAgo(FRESHNESS_THRESHOLD_MINUTES), now: NOW }).ok, true)
    assert.equal(assessFreshness({ activeShops: 1, newestStockSyncedAt: minutesAgo(FRESHNESS_THRESHOLD_MINUTES + 1), now: NOW }).ok, false)
  })

  test('no shops to sync is NOT a failure', () => {
    // An account with no marketplace connected has nothing to sync. Alerting
    // here would make the watchdog noisy, and a noisy watchdog gets muted —
    // which is exactly the failure it exists to prevent.
    const r = assessFreshness({ activeShops: 0, newestStockSyncedAt: null, now: NOW })
    assert.equal(r.ok, true)
    assert.equal(r.state, 'nothing_to_sync')
  })

  test('shops that exist but have NEVER synced are a failure, not a fresh start', () => {
    const r = assessFreshness({ activeShops: 3, newestStockSyncedAt: null, now: NOW })
    assert.equal(r.ok, false)
    assert.equal(r.state, 'never_synced')
  })

  test('a clock skew into the future does not read as stale', () => {
    const r = assessFreshness({ activeShops: 1, newestStockSyncedAt: new Date(NOW.getTime() + 60_000), now: NOW })
    assert.equal(r.ok, true)
    assert.equal(r.staleMinutes, 0, 'never report a negative age')
  })
})
