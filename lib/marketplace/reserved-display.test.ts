import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_STATUS_LOOKBACK_DAYS, BOUNDED_LOOKBACK_MARKETPLACES, cutoffFor, isCorrectable,
} from './reserved-display'
import { RESERVING_RAW_STATUSES } from './stock-allocation'

const NOW = new Date('2026-08-24T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

// ── No marketplace is bounded today ─────────────────────────────────────────
// Yandex Market was the only marketplace whose order sync asked for a bounded
// window by creation date, and it was removed when it left Uzbekistan
// (10 Nov 2026). The machinery stays because the defect it fixes is a property
// of that KIND of sync, not of that marketplace: the moment one is added back,
// listing it here is the whole fix. Until then the list is empty and every
// order stays correctable.

test('the bounded-lookback list is empty — nothing ages out today', () => {
  assert.deepEqual([...BOUNDED_LOOKBACK_MARKETPLACES], [])
  assert.equal(BOUNDED_LOOKBACK_MARKETPLACES.includes('uzum'), false)
})

// Uzum's sync sends no date filter and re-reads everything, so ageing an Uzum
// order out would stop subtracting a unit that is genuinely held — inflating
// displayed stock and inviting an oversell. That is the dangerous direction.

test('an Uzum order is correctable at any age', () => {
  assert.equal(isCorrectable('uzum', daysAgo(400), NOW), true)
  assert.equal(isCorrectable('uzum', daysAgo(31), NOW), true)
  assert.equal(isCorrectable('uzum', NOW, NOW), true)
})

test('an unknown marketplace defaults to correctable, not aged out', () => {
  // Fail toward subtracting: a marketplace we know nothing about must not have
  // its orders silently dropped from the reservation count. A removed one is
  // the same case.
  assert.equal(isCorrectable('wildberries', daysAgo(400), NOW), true)
  assert.equal(isCorrectable('yandex_market', daysAgo(400), NOW), true)
})

// ── The cutoff maths, independent of who is bounded ──────────────────────────

test('the lookback window is 30 days, and cutoffFor computes it', () => {
  assert.equal(ORDER_STATUS_LOOKBACK_DAYS, 30)
  assert.equal(cutoffFor(NOW).toISOString().slice(0, 10), '2026-07-25')
})

test('cutoffFor does not mutate the date it is given', () => {
  const probe = new Date(NOW)
  cutoffFor(probe)
  assert.equal(probe.getTime(), NOW.getTime())
})

// ── Defect 1 does NOT subsume defect 2 ──────────────────────────────────────
// The load-bearing claim in the PR that added this: unifying the status set
// alone would not have fixed the unbounded subtraction, because the
// stuck-prone statuses are exactly the ones the engine treats as reserving.
// Still true, and still the reason the bound exists at all.

test('the engine-reserved statuses are the ones an order gets STUCK in', () => {
  for (const stuckProne of ['DELIVERING', 'ACCEPTED_AT_DP']) {
    assert.ok(
      (RESERVING_RAW_STATUSES as readonly string[]).includes(stuckProne),
      `${stuckProne} is in the reserving set, so narrowing the status set cannot age it out`,
    )
  }
})
