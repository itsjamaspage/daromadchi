// Locks the stale-sync fix: a late-flipping order (old date, freshly-changed
// status) present only in the undated recent pass must survive the merge — the
// old window-filter would have dropped it. Pure, no DB.
// Run:  node --import tsx --test lib/uzum/settlement-merge.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSettlementItems } from './settlement-merge'

type Item = { id: number; date?: number; status?: string }

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
