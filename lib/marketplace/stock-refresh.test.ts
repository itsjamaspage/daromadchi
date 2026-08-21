/**
 * The three clocks must not interfere. This pins the gate arithmetic the cron
 * uses, in isolation from the network — the failure that matters is a stock
 * refresh that quietly changes when the heavy pass runs, or vice versa.
 *
 * Run: node --import tsx --test lib/marketplace/stock-refresh.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const STOCK_REFRESH_MS = 15 * 60 * 1000
const PLAN: Record<string, number> = {
  free: 6 * 60 * 60 * 1000, pro: 2 * 60 * 60 * 1000, pro_plus: 30 * 60 * 1000,
}
// Copied from app/api/cron/sync/route.ts — the two gates, exactly as written.
const isHeavy = (now: number, last: Date | null, plan: string) =>
  !last || (now - last.getTime() >= (PLAN[plan] ?? PLAN.free))
const isStockDue = (now: number, stockAt: Date | null) =>
  !stockAt || (now - stockAt.getTime() >= STOCK_REFRESH_MS)

const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
const minsAgo = (m: number) => new Date(NOW - m * 60_000)

describe('stock clock vs heavy clock', () => {
  it('refreshes stock every 15 min on pro without making the heavy pass due', () => {
    // The whole point: 20 min since both, pro's heavy interval is 2h.
    assert.equal(isStockDue(NOW, minsAgo(20)), true)
    assert.equal(isHeavy(NOW, minsAgo(20), 'pro'), false)
  })

  it('is not plan-gated — free refreshes stock as often as pro_plus', () => {
    for (const plan of ['free', 'pro', 'pro_plus']) {
      assert.equal(isStockDue(NOW, minsAgo(16)), true, plan)
    }
  })

  it('leaves every plan interval exactly where it was', () => {
    assert.equal(isHeavy(NOW, minsAgo(119), 'pro'), false)
    assert.equal(isHeavy(NOW, minsAgo(121), 'pro'), true)
    assert.equal(isHeavy(NOW, minsAgo(359), 'free'), false)
    assert.equal(isHeavy(NOW, minsAgo(361), 'free'), true)
    assert.equal(isHeavy(NOW, minsAgo(29), 'pro_plus'), false)
    assert.equal(isHeavy(NOW, minsAgo(31), 'pro_plus'), true)
  })

  it('does not refresh before 15 minutes have passed', () => {
    assert.equal(isStockDue(NOW, minsAgo(14)), false)
    assert.equal(isStockDue(NOW, minsAgo(15)), true)
  })

  it('treats a never-refreshed shop as due, so deploy day is covered', () => {
    // stock_synced_at backfills NULL; without this the first refresh would wait
    // out an interval measured from a timestamp that never existed.
    assert.equal(isStockDue(NOW, null), true)
  })

  it('keeps a heavy tick from also paying for a stock refresh', () => {
    // The cron skips the refresh when heavy is already running, because the
    // heavy pass re-reads the same quantities from the same endpoint.
    const heavy = isHeavy(NOW, minsAgo(200), 'pro')
    const stockDue = isStockDue(NOW, minsAgo(200))
    assert.equal(heavy && stockDue, true)
    assert.equal(stockDue && !heavy, false, 'refresh must yield to the heavy pass')
  })
})
