import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isYandexFulfillmentRequired, isYandexSellerFulfilled } from './fulfillment-statuses'

/**
 * The alert selection as lib/yandex/sync.ts composes it AFTER transition-alerting.
 *
 * alerted = (insert ∪ update) ∧ fulfilment-model ∧ raw-status ∧ NOT already-alerted
 *
 * The change is the third clause: exactly-once used to come from "is this an
 * insert", which permanently missed anything that only became fulfilment-ready
 * on a later tick. It now comes from the persisted orders.alert_sent_at marker.
 */
function alertedExtIds(
  payload: Array<{ id: number; status: string; substatus?: string }>,
  known: Array<{ ext: string; alertSentAt: Date | null }>,
  placement: string | undefined,
): string[] {
  const sellerFulfilled = isYandexSellerFulfilled(placement)
  const alertable = new Set(
    sellerFulfilled
      ? payload.filter(o => isYandexFulfillmentRequired(o)).map(o => String(o.id))
      : [],
  )
  const alreadyAlerted = new Set(known.filter(k => k.alertSentAt != null).map(k => k.ext))
  // Inserts and updates alike — every order in the window is considered.
  return payload
    .map(o => String(o.id))
    .filter(ext => alertable.has(ext) && !alreadyAlerted.has(ext))
}

const STAMP = new Date('2026-08-24T10:00:00Z')
const FBS = 'FBS'

// ── The bug this closes ─────────────────────────────────────────────────────
test('a prepaid order paid on a LATER tick still alerts', () => {
  const id = 60767668490

  // Tick 1 — UNPAID. Correctly silent, and inserted with no marker.
  const t1 = alertedExtIds([{ id, status: 'UNPAID', substatus: 'STARTED' }], [], FBS)
  assert.deepEqual(t1, [], 'an unpaid order must not alert')

  // Tick 2 — paid. It is now an UPDATE, which the old insert-only gate never
  // looked at, so this order was missed permanently.
  const t2 = alertedExtIds(
    [{ id, status: 'PROCESSING', substatus: 'STARTED' }],
    [{ ext: String(id), alertSentAt: null }],
    FBS,
  )
  assert.deepEqual(t2, [String(id)], 'the transition into PROCESSING must alert')
})

test('and it does not alert again on every subsequent tick', () => {
  const id = 60767668490
  // Tick 3+ — same order, still PROCESSING, now carrying the marker.
  const t3 = alertedExtIds(
    [{ id, status: 'PROCESSING', substatus: 'STARTED' }],
    [{ ext: String(id), alertSentAt: STAMP }],
    FBS,
  )
  assert.deepEqual(t3, [], 'an already-announced order must stay silent')
})

// ── Exactly-once no longer depends on "is this an insert" ───────────────────
test('an order inserted straight into PROCESSING alerts once, then never again', () => {
  const payload = [{ id: 1, status: 'PROCESSING', substatus: 'STARTED' }]
  assert.deepEqual(alertedExtIds(payload, [], FBS), ['1'])
  assert.deepEqual(alertedExtIds(payload, [{ ext: '1', alertSentAt: STAMP }], FBS), [])
})

test('a status re-read many times over never re-announces', () => {
  const payload = [{ id: 1, status: 'PROCESSING', substatus: 'READY_TO_SHIP' }]
  const known = [{ ext: '1', alertSentAt: STAMP }]
  for (let tick = 0; tick < 20; tick++) {
    assert.deepEqual(alertedExtIds(payload, known, FBS), [], `tick ${tick} re-announced`)
  }
})

// ── The #299 guarantees must survive ────────────────────────────────────────
test('the reported bug stays fixed: UNPAID → CANCELLED never alerts, at any point', () => {
  const id = 60767668482
  assert.deepEqual(alertedExtIds([{ id, status: 'UNPAID', substatus: 'STARTED' }], [], FBS), [])
  assert.deepEqual(
    alertedExtIds(
      [{ id, status: 'CANCELLED', substatus: 'USER_NOT_PAID' }],
      [{ ext: String(id), alertSentAt: null }],
      FBS,
    ),
    [],
    'an order that never became fulfilment-ready must never alert',
  )
})

test('FBY still alerts nothing, even on a transition', () => {
  assert.deepEqual(
    alertedExtIds(
      [{ id: 2, status: 'PROCESSING', substatus: 'STARTED' }],
      [{ ext: '2', alertSentAt: null }],
      'FBY',
    ),
    [],
  )
})

test('an unestablished fulfilment model still alerts nothing', () => {
  assert.deepEqual(
    alertedExtIds([{ id: 2, status: 'PROCESSING', substatus: 'STARTED' }], [], undefined),
    [],
  )
})

// ── Mixed window ────────────────────────────────────────────────────────────
test('a realistic tick alerts only the newly-qualifying orders', () => {
  const payload = [
    { id: 1, status: 'UNPAID',     substatus: 'STARTED' },       // not yet
    { id: 2, status: 'PROCESSING', substatus: 'STARTED' },       // ← transition, alert
    { id: 3, status: 'PROCESSING', substatus: 'READY_TO_SHIP' }, // already told them
    { id: 4, status: 'DELIVERY',   substatus: 'SHIPPED' },       // gone past it
    { id: 5, status: 'PROCESSING', substatus: 'STARTED' },       // ← brand new, alert
  ]
  const known = [
    { ext: '1', alertSentAt: null },
    { ext: '2', alertSentAt: null },
    { ext: '3', alertSentAt: STAMP },
    { ext: '4', alertSentAt: STAMP },
  ]
  assert.deepEqual(alertedExtIds(payload, known, FBS), ['2', '5'])
})

// ── Backfill safety ─────────────────────────────────────────────────────────
test('migration 081 backfilling NULL cannot re-announce a finished order', () => {
  // Every pre-existing row reads as "never alerted". The gate checks the CURRENT
  // raw status, so only orders still sitting in a fulfilment-required state can
  // alert — which are exactly the ones the seller still has to ship.
  const finished = [
    { id: 1, status: 'DELIVERED', substatus: 'DELIVERED_USER' },
    { id: 2, status: 'CANCELLED', substatus: 'USER_REFUSED_PRODUCT' },
    { id: 3, status: 'DELIVERY',  substatus: 'SHIPPED' },
    { id: 4, status: 'PICKUP',    substatus: 'READY_TO_SHIP' },
  ]
  const known = finished.map(o => ({ ext: String(o.id), alertSentAt: null }))
  assert.deepEqual(alertedExtIds(finished, known, FBS), [])
})
