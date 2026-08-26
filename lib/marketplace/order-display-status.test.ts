// Run: node --import tsx --test lib/marketplace/order-display-status.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderDisplayStatus } from './order-display-status'

describe('the reported order: packed, not shipped', () => {
  it('Yandex PROCESSING is "preparing", not "on the way"', () => {
    // Order 60870363586. Yandex's own UI: «Обрабатывается · Готов к отгрузке».
    // The seller had not handed it to the pickup point yet.
    assert.equal(orderDisplayStatus('confirmed', 'PROCESSING'), 'preparing')
  })

  it('Yandex DELIVERY and PICKUP really are on the way', () => {
    assert.equal(orderDisplayStatus('confirmed', 'DELIVERY'), 'shipping')
    // PICKUP is at the pickup point awaiting collection — gone from the seller.
    assert.equal(orderDisplayStatus('confirmed', 'PICKUP'), 'shipping')
  })
})

describe('Uzum lands in the same places', () => {
  it('packing states are "preparing", shipped states are "shipping"', () => {
    for (const raw of ['PACKING', 'PACKED', 'ASSEMBLED', 'PENDING_DELIVERY']) {
      assert.equal(orderDisplayStatus('pending', raw), 'preparing', raw)
    }
    for (const raw of ['DELIVERING', 'ACCEPTED_AT_DP']) {
      assert.equal(orderDisplayStatus('confirmed', raw), 'shipping', raw)
    }
  })

  it('the two marketplaces agree for the same real-world stage', () => {
    // "seller is packing" and "parcel has left" must read identically whichever
    // marketplace the order came from — that disagreement was the bug.
    assert.equal(orderDisplayStatus('confirmed', 'PROCESSING'),
                 orderDisplayStatus('pending', 'PACKING'))
    assert.equal(orderDisplayStatus('confirmed', 'DELIVERY'),
                 orderDisplayStatus('confirmed', 'DELIVERING'))
  })
})

describe('terminal states ignore the raw value', () => {
  it('delivered and cancelled win over anything in marketplace_status', () => {
    assert.equal(orderDisplayStatus('delivered', 'DELIVERY'), 'delivered')
    assert.equal(orderDisplayStatus('cancelled', 'PROCESSING'), 'cancelled')
    assert.equal(orderDisplayStatus('returned', 'PICKUP'), 'cancelled')
  })
})

describe('missing or unknown raw values', () => {
  it('never claims a parcel shipped without evidence', () => {
    // The cautious half: saying "not shipped" when it has costs a glance at the
    // marketplace; saying "shipped" when it has not costs a missed shipment.
    for (const raw of [null, undefined, '', '   ', 'SOMETHING_NEW', 'UNKNOWN']) {
      assert.notEqual(orderDisplayStatus('confirmed', raw), 'shipping', String(raw))
    }
  })

  it('a bare confirmed with no raw value reads as preparing', () => {
    assert.equal(orderDisplayStatus('confirmed', null), 'preparing')
  })

  it('pending stays pending', () => {
    assert.equal(orderDisplayStatus('pending', null), 'pending')
  })

  it('is case- and whitespace-insensitive about the raw value', () => {
    assert.equal(orderDisplayStatus('confirmed', ' delivery '), 'shipping')
    assert.equal(orderDisplayStatus('confirmed', 'processing'), 'preparing')
  })
})
