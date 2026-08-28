import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profitTier, COST_MISSING_MATERIAL } from './profit-presentation.ts'

test('no missing cost → exact, no warning', () => {
  assert.deepEqual(
    profitTier({ countedRevenue: 200_000, costMissingRevenue: 0 }),
    { kind: 'exact', warnMissingCost: false },
  )
})

test('immaterial missing cost (< 40%) → exact, with warning', () => {
  // 20% of counted revenue uncosted — bound is nearly tight, keep the number.
  const t = profitTier({ countedRevenue: 200_000, costMissingRevenue: 40_000 })
  assert.deepEqual(t, { kind: 'exact', warnMissingCost: true })
})

test('exactly at the 40% threshold → bounded', () => {
  const t = profitTier({ countedRevenue: 200_000, costMissingRevenue: 80_000 })
  assert.deepEqual(t, { kind: 'bounded' })
})

test('material but partial (40–99%) → bounded', () => {
  const t = profitTier({ countedRevenue: 200_000, costMissingRevenue: 150_000 })
  assert.deepEqual(t, { kind: 'bounded' })
})

test('every counted soʼm uncosted (100%) → suppressed', () => {
  const t = profitTier({ countedRevenue: 200_000, costMissingRevenue: 200_000 })
  assert.deepEqual(t, { kind: 'suppressed' })
})

test('missing cost above counted revenue is clamped to 100% → suppressed', () => {
  // Shouldn't happen (missing ⊆ counted) but must never divide past 1 or crash.
  const t = profitTier({ countedRevenue: 200_000, costMissingRevenue: 250_000 })
  assert.deepEqual(t, { kind: 'suppressed' })
})

test('nothing counted → exact, no warning (coverage line tells the story)', () => {
  assert.deepEqual(
    profitTier({ countedRevenue: 0, costMissingRevenue: 0 }),
    { kind: 'exact', warnMissingCost: false },
  )
})

test('the real-screenshot case: 155.5k with the M9 cost deleted', () => {
  // countedRevenue = 200k (Uzum M9 ×2), all of it uncosted after the delete →
  // "155 500 profit" would be revenue − commission. Must suppress, not show it.
  assert.deepEqual(
    profitTier({ countedRevenue: 200_000, costMissingRevenue: 200_000 }),
    { kind: 'suppressed' },
  )
})

test('threshold is 40%', () => {
  assert.equal(COST_MISSING_MATERIAL, 0.40)
})

test('custom threshold is honoured', () => {
  const t = profitTier({ countedRevenue: 100, costMissingRevenue: 30, materialThreshold: 0.25 })
  assert.deepEqual(t, { kind: 'bounded' })
})
