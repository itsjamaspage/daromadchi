import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_STATUS_LOOKBACK_DAYS, BOUNDED_LOOKBACK_MARKETPLACES, cutoffFor, isCorrectable,
} from './reserved-display'
import { RESERVING_RAW_STATUSES } from './stock-allocation'

const NOW = new Date('2026-08-24T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

// ── Defect 2: an order the sync can never correct must stop subtracting ─────

test('a Yandex order older than the lookback is not correctable', () => {
  assert.equal(isCorrectable('yandex_market', daysAgo(31), NOW), false)
})

test('a Yandex order inside the lookback is still correctable', () => {
  assert.equal(isCorrectable('yandex_market', daysAgo(29), NOW), true)
  assert.equal(isCorrectable('yandex_market', NOW, NOW), true)
})

test('the boundary itself counts as correctable', () => {
  // The sync asks for orders created ON the cutoff date, so an order exactly
  // there is still re-read. Excluding it would stop subtracting a unit the
  // sync is about to refresh.
  assert.equal(isCorrectable('yandex_market', cutoffFor(NOW), NOW), true)
})

// ── Why the bound is per-marketplace ────────────────────────────────────────
// Uzum's sync sends no date filter and re-reads everything, so ageing an Uzum
// order out would stop subtracting a unit that is genuinely held — inflating
// displayed stock and inviting an oversell. That is the dangerous direction.

test('an Uzum order is correctable at any age', () => {
  assert.equal(isCorrectable('uzum', daysAgo(400), NOW), true)
  assert.equal(isCorrectable('uzum', daysAgo(31), NOW), true)
})

test('only marketplaces with a bounded sync are listed', () => {
  assert.deepEqual([...BOUNDED_LOOKBACK_MARKETPLACES], ['yandex_market'])
  assert.equal(BOUNDED_LOOKBACK_MARKETPLACES.includes('uzum'), false)
})

test('an unknown marketplace defaults to correctable, not aged out', () => {
  // Fail toward subtracting: a marketplace we know nothing about must not have
  // its orders silently dropped from the reservation count.
  assert.equal(isCorrectable('wildberries', daysAgo(400), NOW), true)
})

// ── The constant is shared, not copied ──────────────────────────────────────

test('the lookback matches the window the Yandex sync asks for', () => {
  assert.equal(ORDER_STATUS_LOOKBACK_DAYS, 30)
  assert.equal(cutoffFor(NOW).toISOString().slice(0, 10), '2026-07-25')
})

// ── Defect 1 does NOT subsume defect 2 ──────────────────────────────────────
// The load-bearing claim in the PR: unifying the status set alone would not
// have fixed the unbounded subtraction, because the stuck-prone statuses are
// exactly the ones the engine treats as reserving.

test('the engine-reserved statuses are the ones an order gets STUCK in', () => {
  for (const stuckProne of ['PICKUP', 'DELIVERY']) {
    assert.ok(
      (RESERVING_RAW_STATUSES as readonly string[]).includes(stuckProne),
      `${stuckProne} is in the reserving set, so narrowing the status set cannot age it out`,
    )
  }
})

test('so a stuck Yandex PICKUP order needs the date bound to stop subtracting', () => {
  // Engine-reserved (would survive defect 1's fix) but frozen (needs defect 2's).
  assert.ok((RESERVING_RAW_STATUSES as readonly string[]).includes('PICKUP'))
  assert.equal(isCorrectable('yandex_market', daysAgo(400), NOW), false)
})

// ── `now` is a parameter, not a hidden clock ────────────────────────────────

test('the same order flips correctability as the clock advances, not before', () => {
  const ordered = daysAgo(20)
  assert.equal(isCorrectable('yandex_market', ordered, NOW), true)
  const later = new Date(NOW.getTime() + 15 * 24 * 60 * 60 * 1000)
  assert.equal(isCorrectable('yandex_market', ordered, later), false)
})

test('cutoffFor does not mutate the date it is given', () => {
  const probe = new Date(NOW)
  cutoffFor(probe)
  assert.equal(probe.getTime(), NOW.getTime())
})
