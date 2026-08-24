import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isYandexFulfillmentRequired } from './fulfillment-statuses'

const ym = (status: string, substatus?: string) => ({ status, substatus })

// Every top-level status in Yandex's OrderStatusType, verbatim from the
// Partner API spec. Only PROCESSING can ever alert.
const ALL_STATUSES = [
  'PLACING', 'RESERVED', 'UNPAID', 'PROCESSING', 'DELIVERY', 'PICKUP',
  'DELIVERED', 'CANCELLED', 'PENDING', 'PARTIALLY_RETURNED', 'RETURNED', 'UNKNOWN',
]

test('alerts only on PROCESSING/STARTED and PROCESSING/READY_TO_SHIP', () => {
  assert.equal(isYandexFulfillmentRequired(ym('PROCESSING', 'STARTED')), true)
  assert.equal(isYandexFulfillmentRequired(ym('PROCESSING', 'READY_TO_SHIP')), true)
})

test('never alerts on any non-PROCESSING status, whatever the substatus', () => {
  for (const status of ALL_STATUSES.filter(s => s !== 'PROCESSING')) {
    // Including the substatuses that WOULD pass under PROCESSING — the status
    // must gate first, or a CANCELLED/STARTED payload would slip through.
    for (const sub of ['STARTED', 'READY_TO_SHIP', 'USER_NOT_PAID', undefined]) {
      assert.equal(
        isYandexFulfillmentRequired(ym(status, sub)), false,
        `${status}/${sub} must not alert`,
      )
    }
  }
})

test('PROCESSING alone is not enough — SHIPPED and unknown substatuses are excluded', () => {
  assert.equal(isYandexFulfillmentRequired(ym('PROCESSING', 'SHIPPED')), false)
  assert.equal(isYandexFulfillmentRequired(ym('PROCESSING', 'PACKAGING_NEW_SUBSTATUS')), false)
})

test('a missing or empty substatus is excluded, not defaulted in', () => {
  // substatus is REQUIRED on Yandex's OrderDTO, so this means the payload shape
  // changed. The safe answer is "no alert" — the opposite default is the bug.
  assert.equal(isYandexFulfillmentRequired({ status: 'PROCESSING' }), false)
  assert.equal(isYandexFulfillmentRequired({ status: 'PROCESSING', substatus: null }), false)
  assert.equal(isYandexFulfillmentRequired({ status: 'PROCESSING', substatus: '' }), false)
})

test('an unrecognised status defaults to no alert', () => {
  assert.equal(isYandexFulfillmentRequired(ym('SOME_FUTURE_STATUS', 'STARTED')), false)
  assert.equal(isYandexFulfillmentRequired({}), false)
  assert.equal(isYandexFulfillmentRequired({ status: null, substatus: null }), false)
})

// ── Regression: the reported bug ────────────────────────────────────────────
// Order 60767668482 — PREPAID, never paid, auto-cancelled by Yandex after 30
// minutes. Under the old gate BOTH of these states normalized to `pending`
// (UNPAID via the `?? 'pending'` fallback) and the first one fired the
// "collect and ship" alert.
test('replay 60767668482: no state in its lifecycle alerts', () => {
  const lifecycle = [
    ym('UNPAID', 'STARTED'),               // as first seen by the sync
    ym('CANCELLED', 'USER_NOT_PAID'),      // «Отменён до обработки»
  ]
  for (const state of lifecycle) {
    assert.equal(
      isYandexFulfillmentRequired(state), false,
      `${state.status}/${state.substatus} must not alert`,
    )
  }
})

// ── The alert selection, as the sync composes it ────────────────────────────
// Mirrors lib/yandex/sync.ts: alertable = raw-status gate; alerted = alertable
// ∩ first-ever-insert. Proves the two conditions compose so an order that is
// fulfilment-required but already known does NOT re-alert.
function alertedExtIds(
  payload: Array<{ id: number; status: string; substatus?: string }>,
  alreadyKnown: string[],
): string[] {
  const known = new Set(alreadyKnown)
  const alertable = new Set(
    payload.filter(o => isYandexFulfillmentRequired(o)).map(o => String(o.id)),
  )
  const toInsert = payload.map(o => String(o.id)).filter(id => !known.has(id))
  return toInsert.filter(id => alertable.has(id))
}

test('a real paid order alerts once, and not again on the next tick', () => {
  const payload = [{ id: 60767668483, status: 'PROCESSING', substatus: 'STARTED' }]

  // Tick 1 — order is new.
  assert.deepEqual(alertedExtIds(payload, []), ['60767668483'])
  // Tick 2 — same order re-pulled by the rolling 30-day window, now known.
  assert.deepEqual(alertedExtIds(payload, ['60767668483']), [])
})

test('a mixed payload alerts only the order that needs picking', () => {
  const payload = [
    { id: 1, status: 'UNPAID',     substatus: 'STARTED' },        // the bug
    { id: 2, status: 'PROCESSING', substatus: 'STARTED' },        // real work
    { id: 3, status: 'CANCELLED',  substatus: 'USER_NOT_PAID' },
    { id: 4, status: 'DELIVERY',   substatus: 'SHIPPED' },
    { id: 5, status: 'PROCESSING', substatus: 'READY_TO_SHIP' },  // real work
  ]
  assert.deepEqual(alertedExtIds(payload, []), ['2', '5'])
})
