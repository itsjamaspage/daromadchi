import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isUzumFulfillmentRequired, orderNeedsFulfilment, UZ_FULFILLMENT_STATUSES,
} from './fulfillment-statuses'

// Positive-whitelist discipline: an unrecognised raw status must mean "no
// action needed", never "collect and ship". That default is what stopped an
// unpaid, auto-cancelled order being announced (#299).

test('Uzum statuses meaning the seller is still preparing the order', () => {
  for (const s of ['CREATED', 'PACKING', 'PENDING_DELIVERY']) {
    assert.equal(isUzumFulfillmentRequired(s), true, s)
  }
})

test('already handed over, finished, or cancelled needs nothing', () => {
  for (const s of ['DELIVERING', 'ACCEPTED_AT_DP', 'DELIVERED', 'COMPLETED',
                   'CANCELED', 'RETURNED', 'PENDING_CANCELLATION',
                   'DELIVERED_TO_CUSTOMER_DELIVERY_POINT']) {
    assert.equal(isUzumFulfillmentRequired(s), false, s)
  }
})

test('an unrecognised status is false, not true', () => {
  // Uzum's enum is fetched live from their OpenAPI doc, so new values appear
  // without warning. Failing open here would recreate the `?? pending` bug.
  assert.equal(isUzumFulfillmentRequired('SOME_NEW_STATUS_2027'), false)
})

test('null and empty are false', () => {
  assert.equal(isUzumFulfillmentRequired(null), false)
  assert.equal(isUzumFulfillmentRequired(undefined), false)
  assert.equal(isUzumFulfillmentRequired(''), false)
})

test('matching is case-insensitive', () => {
  assert.equal(isUzumFulfillmentRequired('created'), true)
})

// ── The stored-row front door ───────────────────────────────────────────────

test('a NULL raw status is false — pre-migration-054 rows', () => {
  assert.equal(orderNeedsFulfilment({ marketplace: 'uzum', marketplace_status: null }), false)
})

test('an unknown marketplace is false', () => {
  // Uzum is the only integrated marketplace, so a removed or future one must
  // never match an Uzum status vocabulary by accident.
  assert.equal(orderNeedsFulfilment({ marketplace: 'wildberries', marketplace_status: 'CREATED' }), false)
  assert.equal(orderNeedsFulfilment({ marketplace: 'yandex_market', marketplace_status: 'PROCESSING' }), false)
  assert.equal(orderNeedsFulfilment({ marketplace: '', marketplace_status: 'CREATED' }), false)
})

test('an Uzum order matches its own status vocabulary', () => {
  assert.equal(orderNeedsFulfilment({ marketplace: 'uzum', marketplace_status: 'PROCESSING' }), true)
  assert.equal(orderNeedsFulfilment({ marketplace: 'uzum', marketplace_status: 'CREATED' }), true)
})

test('the Uzum whitelist has no terminal state hiding in it', () => {
  for (const bad of ['DELIVERED', 'COMPLETED', 'CANCELED', 'CANCELLED', 'RETURNED']) {
    assert.equal((UZ_FULFILLMENT_STATUSES as readonly string[]).includes(bad), false, bad)
  }
})
