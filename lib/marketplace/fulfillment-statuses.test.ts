import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isYandexFulfillmentRequired, isYandexSellerFulfilled } from './fulfillment-statuses'

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

// ── Fulfilment model ────────────────────────────────────────────────────────
// PlacementType's complete enum per the spec is FBS | FBY | DBS | LAAS.

test('seller-shipped models alert; Yandex-shipped and unknown ones do not', () => {
  assert.equal(isYandexSellerFulfilled('FBS'), true)   // incl. Express — «FBS или Экспресс»
  assert.equal(isYandexSellerFulfilled('DBS'), true)   // seller stores AND delivers
  assert.equal(isYandexSellerFulfilled('FBY'), false)  // Yandex's warehouse ships it
  assert.equal(isYandexSellerFulfilled('LAAS'), false)
})

test('an unestablished fulfilment model never alerts', () => {
  // This is what the caller holds when the campaign-info call failed. Reading
  // the sync's campaignFulfillmentType instead would say 'fbs' here and alert.
  assert.equal(isYandexSellerFulfilled(undefined), false)
  assert.equal(isYandexSellerFulfilled(null), false)
  assert.equal(isYandexSellerFulfilled(''), false)
  assert.equal(isYandexSellerFulfilled('SOME_FUTURE_MODEL'), false)
})

test('placement matching is case-insensitive', () => {
  assert.equal(isYandexSellerFulfilled('fbs'), true)
  assert.equal(isYandexSellerFulfilled('dbs'), true)
})

// ── The alert selection, as the sync composes it ────────────────────────────
// Mirrors lib/yandex/sync.ts: alertable = fulfilment-model gate ∧ raw-status
// gate; alerted = alertable ∩ first-ever-insert. Proves the three conditions
// compose — so an order that is fulfilment-required but already known does NOT
// re-alert, and an FBY campaign alerts nothing at all.
// `placement` is deliberately REQUIRED and un-defaulted: a default parameter
// would swallow an explicitly-passed `undefined` and silently turn the
// "model could not be read" case into an FBS one. The sync holds it in a plain
// `let campaignPlacement: string | undefined`, so undefined reaches the gate.
function alertedExtIds(
  payload: Array<{ id: number; status: string; substatus?: string }>,
  alreadyKnown: string[],
  placement: string | undefined,
): string[] {
  const sellerFulfilled = isYandexSellerFulfilled(placement)
  const alertable = new Set(
    sellerFulfilled
      ? payload.filter(o => isYandexFulfillmentRequired(o)).map(o => String(o.id))
      : [],
  )
  const known = new Set(alreadyKnown)
  const toInsert = payload.map(o => String(o.id)).filter(id => !known.has(id))
  return toInsert.filter(id => alertable.has(id))
}

test('a real paid order alerts once, and not again on the next tick', () => {
  const payload = [{ id: 60767668483, status: 'PROCESSING', substatus: 'STARTED' }]

  // Tick 1 — order is new.
  assert.deepEqual(alertedExtIds(payload, [], 'FBS'), ['60767668483'])
  // Tick 2 — same order re-pulled by the rolling 30-day window, now known.
  assert.deepEqual(alertedExtIds(payload, ['60767668483'], 'FBS'), [])
})

test('a mixed payload alerts only the order that needs picking', () => {
  const payload = [
    { id: 1, status: 'UNPAID',     substatus: 'STARTED' },        // the bug
    { id: 2, status: 'PROCESSING', substatus: 'STARTED' },        // real work
    { id: 3, status: 'CANCELLED',  substatus: 'USER_NOT_PAID' },
    { id: 4, status: 'DELIVERY',   substatus: 'SHIPPED' },
    { id: 5, status: 'PROCESSING', substatus: 'READY_TO_SHIP' },  // real work
  ]
  assert.deepEqual(alertedExtIds(payload, [], 'FBS'), ['2', '5'])
})

test('a DBS campaign alerts — the seller stores and delivers it themselves', () => {
  // Reachable today, not hypothetical: campaignId is entered free-form by the
  // seller (app/api/shops/token/route.ts) and no onboarding path filters on
  // placementType, so a DBS campaign syncs through this exact code. Pinned here
  // so "DBS alerts" is deliberate behaviour rather than a side effect of the
  // allowlist happening to contain it.
  const payload = [{ id: 2, status: 'PROCESSING', substatus: 'STARTED' }]
  assert.deepEqual(alertedExtIds(payload, [], 'DBS'), ['2'])
  // …and the status gate still applies on DBS — the model gate does not
  // short-circuit it.
  const unpaid = [{ id: 3, status: 'UNPAID', substatus: 'STARTED' }]
  assert.deepEqual(alertedExtIds(unpaid, [], 'DBS'), [])
})

test('an FBY campaign alerts nothing, even on a fulfilment-ready order', () => {
  const payload = [{ id: 2, status: 'PROCESSING', substatus: 'STARTED' }]
  assert.deepEqual(alertedExtIds(payload, [], 'FBY'), [])
  // Same order on a seller-shipped campaign still alerts — proves the FBY
  // result is the model gate, not an accidentally broken status gate.
  assert.deepEqual(alertedExtIds(payload, [], 'FBS'), ['2'])
})

test('a campaign whose model could not be read alerts nothing', () => {
  const payload = [{ id: 2, status: 'PROCESSING', substatus: 'STARTED' }]
  assert.deepEqual(alertedExtIds(payload, [], undefined), [])
})
