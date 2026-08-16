// Locks the stale-sync fix: a late-flipping order (old date, freshly-changed
// status) present only in the undated recent pass must survive the merge — the
// old window-filter would have dropped it. Pure, no DB.
// Run:  node --import tsx --test lib/uzum/settlement-merge.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeSettlementItems,
  isTerminalUzumStatus,
  collectUndatedUntilCovered,
  type UndatedPage,
} from './settlement-merge'

type Item = { id: number; date?: number; status?: string }

// A fake paged feed: `total` items, recent-first, with `targetId` planted at
// `targetPage`. Lets us simulate a shop with more recent activity than the cap.
function fakeFeed(total: number, targetId: number, targetPage: number, pageSize = 100) {
  return async (page: number): Promise<UndatedPage<Item>> => {
    const start = page * pageSize
    if (start >= total) return { items: [], totalElements: total }
    const items: Item[] = []
    for (let i = 0; i < pageSize && start + i < total; i++) {
      const globalIdx = start + i
      // Plant the target as the first item of its page; fillers use negative ids.
      items.push(page === targetPage && i === 0 ? { id: targetId, status: 'TO_WITHDRAW' } : { id: -(globalIdx + 1), status: 'PROCESSING' })
    }
    return { items, totalElements: total }
  }
}

describe('mergeSettlementItems — late-flipping orders refresh (PROBLEM 2)', () => {
  const JUL_26 = Date.parse('2026-07-26')
  const NOW = Date.parse('2026-08-14')
  const windowStart = NOW - 14 * 24 * 60 * 60 * 1000 // 14-day window ≈ 31 Jul

  it('keeps a late-flipped order that the old 14-day window would have dropped', () => {
    // Order 117751391: delivered 26 Jul (outside the window), just flipped to
    // TO_WITHDRAW. Only the undated recent pass returns it.
    const dated: Item[] = [{ id: 999, date: NOW, status: 'PROCESSING' }] // recent, in-window
    const undated: Item[] = [
      { id: 999, date: NOW, status: 'PROCESSING' },                 // overlap with dated
      { id: 117751391, date: JUL_26, status: 'TO_WITHDRAW' },       // late flip, old date
    ]
    const merged = mergeSettlementItems(dated, undated)
    const flipped = merged.find(m => m.id === 117751391)
    assert.ok(flipped, 'late-flipped order must be present in the merge')
    assert.equal(flipped!.status, 'TO_WITHDRAW')
    // Prove the OLD behavior would have dropped it:
    assert.equal(undated.filter(i => i.date! >= windowStart).some(i => i.id === 117751391), false)
  })

  it('dedupes by id (overlap between passes → one row)', () => {
    const merged = mergeSettlementItems(
      [{ id: 1 }, { id: 2 }],
      [{ id: 2 }, { id: 3 }],
    )
    assert.deepEqual(merged.map(m => m.id).sort((a, b) => a - b), [1, 2, 3])
  })

  it('undated status wins on conflict (fresher live read)', () => {
    const merged = mergeSettlementItems<Item>(
      [{ id: 5, status: 'PROCESSING' }],
      [{ id: 5, status: 'TO_WITHDRAW' }],
    )
    assert.equal(merged.find(m => m.id === 5)!.status, 'TO_WITHDRAW')
  })

  it('handles empty passes', () => {
    assert.deepEqual(mergeSettlementItems([], []), [])
    assert.deepEqual(mergeSettlementItems<Item>([{ id: 1 }], []).map(m => m.id), [1])
    assert.deepEqual(mergeSettlementItems<Item>([], [{ id: 1 }]).map(m => m.id), [1])
  })
})

describe('isTerminalUzumStatus', () => {
  it('TO_WITHDRAW / CANCELED / PARTIALLY_CANCELLED are terminal', () => {
    assert.equal(isTerminalUzumStatus('TO_WITHDRAW'), true)
    assert.equal(isTerminalUzumStatus('CANCELED'), true)
    assert.equal(isTerminalUzumStatus('PARTIALLY_CANCELLED'), true)
  })
  it('PROCESSING and unknown are NOT terminal (keep refreshing)', () => {
    assert.equal(isTerminalUzumStatus('PROCESSING'), false)
    assert.equal(isTerminalUzumStatus('SOMETHING_NEW'), false)
    assert.equal(isTerminalUzumStatus(null), false)
  })
})

describe('collectUndatedUntilCovered — no invisible ceiling (STEP 1 fix)', () => {
  // THE test: a shop with more recent activity than the baseline sweep still
  // refreshes an old non-terminal order sitting beyond it.
  it('shop with >minPages recent items STILL refreshes an old non-terminal order', async () => {
    const target = 117751391
    // 2000 recent items; the stale order is on page 15 — beyond a 10-page baseline.
    const feed = fakeFeed(2000, target, 15)
    const res = await collectUndatedUntilCovered(feed, new Set([target]), { minPages: 10, maxPages: 30 })
    assert.equal(res.coveredAll, true)
    assert.equal(res.hitCap, false)
    assert.ok(res.items.some(i => i.id === target), 'the old non-terminal order was fetched')
    assert.equal(res.pagesFetched, 16) // stopped right after covering it
  })

  it('hard cap reached with the order still uncovered → hitCap=true (caller warns)', async () => {
    const target = 117751391
    const feed = fakeFeed(2000, target, 15) // on page 15, but cap is 10
    const res = await collectUndatedUntilCovered(feed, new Set([target]), { minPages: 5, maxPages: 10 })
    assert.equal(res.coveredAll, false)
    assert.equal(res.hitCap, true)
    assert.equal(res.items.some(i => i.id === target), false)
  })

  it('nothing to cover → just the baseline sweep, no over-paging', async () => {
    const feed = fakeFeed(2000, -1, 999) // target never appears
    const res = await collectUndatedUntilCovered<Item>(feed, new Set(), { minPages: 3, maxPages: 30 })
    assert.equal(res.coveredAll, true)
    assert.equal(res.pagesFetched, 3) // exactly the baseline
    assert.equal(res.hitCap, false)
  })

  it('feed shorter than the cap → stops at exhaustion, not a cap warning', async () => {
    const feed = fakeFeed(120, 999, 999, 100) // 2 pages total; order not present
    const res = await collectUndatedUntilCovered<Item>(feed, new Set([999]), { minPages: 10, maxPages: 30 })
    assert.equal(res.hitCap, false)          // exhausted, not capped
    assert.equal(res.coveredAll, false)      // order genuinely absent from Uzum's feed
    assert.equal(res.pagesFetched, 2)
  })
})
