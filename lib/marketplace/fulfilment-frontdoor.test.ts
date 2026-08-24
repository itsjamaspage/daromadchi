import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isUzumFulfillmentRequired, orderNeedsFulfilment, UZ_FULFILLMENT_STATUSES,
} from './fulfillment-statuses'

// Same positive-whitelist discipline as the Yandex gate: an unrecognised raw
// status must mean "no action needed", never "collect and ship". That default
// is what stopped an unpaid, auto-cancelled order being announced (#299).

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

test('a Yandex PROCESSING order needs fulfilment', () => {
  assert.equal(orderNeedsFulfilment({ marketplace: 'yandex_market', marketplace_status: 'PROCESSING' }), true)
})

test('other Yandex statuses do not', () => {
  for (const s of ['UNPAID', 'DELIVERY', 'PICKUP', 'DELIVERED', 'CANCELLED', 'PLACING', 'RESERVED', 'UNKNOWN']) {
    assert.equal(orderNeedsFulfilment({ marketplace: 'yandex_market', marketplace_status: s }), false, s)
  }
})

test('UNPAID is false — the order that started all of this', () => {
  // Order 60767668482: prepaid, never paid, auto-cancelled 30 minutes later,
  // and announced as "collect and ship" because UNPAID fell through to pending.
  assert.equal(orderNeedsFulfilment({ marketplace: 'yandex_market', marketplace_status: 'UNPAID' }), false)
})

test('a NULL raw status is false — pre-migration-054 rows', () => {
  assert.equal(orderNeedsFulfilment({ marketplace: 'yandex_market', marketplace_status: null }), false)
  assert.equal(orderNeedsFulfilment({ marketplace: 'uzum', marketplace_status: null }), false)
})

test('an unknown marketplace is false', () => {
  assert.equal(orderNeedsFulfilment({ marketplace: 'wildberries', marketplace_status: 'CREATED' }), false)
})

test('each marketplace only matches its OWN status vocabulary', () => {
  // CREATED is an Uzum status; it must not make a Yandex order actionable.
  assert.equal(orderNeedsFulfilment({ marketplace: 'yandex_market', marketplace_status: 'CREATED' }), false)
  assert.equal(orderNeedsFulfilment({ marketplace: 'uzum', marketplace_status: 'PROCESSING' }), true)
})

test('the Uzum whitelist has no terminal state hiding in it', () => {
  for (const bad of ['DELIVERED', 'COMPLETED', 'CANCELED', 'CANCELLED', 'RETURNED']) {
    assert.equal((UZ_FULFILLMENT_STATUSES as readonly string[]).includes(bad), false, bad)
  }
})
