import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveMetrics, abcClassify, ABC_A_CUTOFF, ABC_B_CUTOFF } from './product-analytics'

// ── Average realised price ──────────────────────────────────────────────────
// The point of this column is the GAP between it and the listed price: what
// the seller actually got per unit after discounts.

test('average price is revenue over delivered units', () => {
  assert.equal(deriveMetrics({ delivered: 2, returned: 0, revenue: 200_000 }, 200_000).avgPrice, 100_000)
})

test('a discounted sale shows below the listed price', () => {
  // Listed at 100 000, two sold for 152 000 total → 76 000 realised.
  assert.equal(deriveMetrics({ delivered: 2, returned: 0, revenue: 152_000 }, 152_000).avgPrice, 76_000)
})

test('nothing delivered has NO average price, rather than zero', () => {
  // 0 would read as "we sold it for nothing"; null renders as «—».
  assert.equal(deriveMetrics({ delivered: 0, returned: 0, revenue: 0 }, 100).avgPrice, null)
})

test('returns do not inflate the average price', () => {
  // Revenue is of real sales only, and the divisor is delivered only.
  assert.equal(deriveMetrics({ delivered: 2, returned: 3, revenue: 200_000 }, 200_000).avgPrice, 100_000)
})

// ── Return rate ─────────────────────────────────────────────────────────────

test('return rate divides by everything that shipped, not just what stuck', () => {
  // 1 delivered + 1 returned is 50%, not 100%. A returned unit WAS delivered
  // first, so excluding it from the denominator doubles every rate.
  assert.equal(deriveMetrics({ delivered: 1, returned: 1, revenue: 0 }, 0).returnRate, 50)
})

test('no returns is 0%, and nothing shipped is null', () => {
  assert.equal(deriveMetrics({ delivered: 5, returned: 0, revenue: 0 }, 0).returnRate, 0)
  assert.equal(deriveMetrics({ delivered: 0, returned: 0, revenue: 0 }, 0).returnRate, null)
})

test('everything returned is 100%', () => {
  assert.equal(deriveMetrics({ delivered: 0, returned: 4, revenue: 0 }, 0).returnRate, 100)
})

// ── Share of sales ──────────────────────────────────────────────────────────

test('share is this product against the period total', () => {
  assert.equal(deriveMetrics({ delivered: 1, returned: 0, revenue: 25_000 }, 100_000).salesShare, 25)
})

test('a zero period total gives 0%, not a division by zero', () => {
  assert.equal(deriveMetrics({ delivered: 0, returned: 0, revenue: 0 }, 0).salesShare, 0)
})

// ── ABC ─────────────────────────────────────────────────────────────────────

test('the classic split: the top earners are A', () => {
  const c = abcClassify([
    { id: 'a', revenue: 800 },   // 0% before → A
    { id: 'b', revenue: 150 },   // 80% before → B
    { id: 'c', revenue: 50 },    // 95% before → C
  ])
  assert.equal(c.get('a'), 'A')
  assert.equal(c.get('b'), 'B')
  assert.equal(c.get('c'), 'C')
})

test('the product that CROSSES 80% is still an A', () => {
  // Otherwise the A group does not actually cover 80% of revenue, which is the
  // one thing the label promises.
  const c = abcClassify([{ id: 'a', revenue: 79 }, { id: 'b', revenue: 21 }])
  assert.equal(c.get('a'), 'A')
  assert.equal(c.get('b'), 'A', 'it starts below 80%, so it completes the A group')
})

test('a single product carrying everything is A', () => {
  assert.equal(abcClassify([{ id: 'only', revenue: 500 }]).get('only'), 'A')
})

test('products with no revenue are C, not blank', () => {
  // "Earned nothing this period" is exactly what C means. Leaving them
  // unclassified would make an unsold product look like missing data.
  const c = abcClassify([{ id: 'a', revenue: 1000 }, { id: 'dead', revenue: 0 }])
  assert.equal(c.get('dead'), 'C')
})

test('when nothing sold at all, everything is C', () => {
  const c = abcClassify([{ id: 'a', revenue: 0 }, { id: 'b', revenue: 0 }])
  assert.equal(c.get('a'), 'C')
  assert.equal(c.get('b'), 'C')
})

test('every input gets a class — no product falls through', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, revenue: i * 10 }))
  const c = abcClassify(rows)
  assert.equal(c.size, rows.length)
  for (const r of rows) assert.ok(['A', 'B', 'C'].includes(c.get(r.id)!), r.id)
})

test('input order does not change the classification', () => {
  const rows = [{ id: 'a', revenue: 800 }, { id: 'b', revenue: 150 }, { id: 'c', revenue: 50 }]
  const forward = abcClassify(rows)
  const backward = abcClassify([...rows].reverse())
  for (const r of rows) assert.equal(forward.get(r.id), backward.get(r.id), r.id)
})

test('an empty catalogue produces an empty map, not a crash', () => {
  assert.equal(abcClassify([]).size, 0)
})

test('the cutoffs are the standard ones', () => {
  assert.equal(ABC_A_CUTOFF, 80)
  assert.equal(ABC_B_CUTOFF, 95)
})
