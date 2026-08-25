import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CANCELLED_STATUSES, isCancelledStatus, needsCancellationAlert, selectCancellationAlerts,
} from './cancellation-alert'

const NOW = new Date('2026-08-25T10:00:00Z')

// The reported case: order 60810362177 was announced as "collect and ship",
// then cancelled before delivery, and the seller was never told.

test('an announced order that is now cancelled needs the notice', () => {
  assert.equal(needsCancellationAlert({
    order_id_external: '60810362177', status: 'cancelled',
    alert_sent_at: NOW, cancel_alert_sent_at: null,
  }), true)
})

test('returned counts too — the seller is equally not shipping it', () => {
  assert.equal(needsCancellationAlert({
    order_id_external: '1', status: 'returned', alert_sent_at: NOW, cancel_alert_sent_at: null,
  }), true)
})

// ── The clause that stops cancel-spam ───────────────────────────────────────
// Most cancellations are buyers changing their mind minutes after ordering.
// Notifying about orders the seller never heard of would be pure noise.

test('an order we never announced gets no notice', () => {
  assert.equal(needsCancellationAlert({
    order_id_external: '1', status: 'cancelled', alert_sent_at: null, cancel_alert_sent_at: null,
  }), false)
})

test('the notice fires once, not every tick', () => {
  // The syncs re-read the same window every five minutes and the order stays
  // cancelled forever, so without this it would repeat indefinitely.
  assert.equal(needsCancellationAlert({
    order_id_external: '1', status: 'cancelled', alert_sent_at: NOW, cancel_alert_sent_at: NOW,
  }), false)
})

test('a live order gets no notice', () => {
  for (const status of ['pending', 'confirmed', 'delivered']) {
    assert.equal(needsCancellationAlert({
      order_id_external: '1', status, alert_sent_at: NOW, cancel_alert_sent_at: null,
    }), false, status)
  }
})

// ── Failing quiet ───────────────────────────────────────────────────────────

test('an unrecognised status produces silence, not a false cancellation', () => {
  // #299's lesson inverted: there, an unmapped status fell INTO the actionable
  // bucket and announced an unpaid order. Here it falls into 'pending', which
  // is not cancelled — so a vocabulary change costs a missed notice, never a
  // wrong one.
  assert.equal(isCancelledStatus('SOME_NEW_STATUS'), false)
  assert.equal(isCancelledStatus(null), false)
  assert.equal(isCancelledStatus(undefined), false)
  assert.equal(isCancelledStatus(''), false)
})

test('the cancelled set holds only terminal non-fulfilment states', () => {
  assert.deepEqual([...CANCELLED_STATUSES], ['cancelled', 'returned'])
  for (const live of ['pending', 'confirmed', 'delivered']) {
    assert.equal((CANCELLED_STATUSES as readonly string[]).includes(live), false, live)
  }
})

// ── Selecting from a tick's worth of rows ───────────────────────────────────

test('picks the cancelled announced order out of a mixed batch', () => {
  const synced = [
    { order_id_external: 'a', status: 'confirmed' },
    { order_id_external: 'b', status: 'cancelled' },   // announced → notify
    { order_id_external: 'c', status: 'cancelled' },   // never announced → skip
    { order_id_external: 'd', status: 'cancelled' },   // already told → skip
  ]
  const markers = new Map([
    ['a', { alert_sent_at: NOW, cancel_alert_sent_at: null }],
    ['b', { alert_sent_at: NOW, cancel_alert_sent_at: null }],
    ['c', { alert_sent_at: null, cancel_alert_sent_at: null }],
    ['d', { alert_sent_at: NOW, cancel_alert_sent_at: NOW }],
  ])
  assert.deepEqual(selectCancellationAlerts(synced, markers).map(r => r.order_id_external), ['b'])
})

test('a synced order with no stored row is skipped', () => {
  // No stored row means it was never announced — there is nothing to retract.
  const out = selectCancellationAlerts([{ order_id_external: 'x', status: 'cancelled' }], new Map())
  assert.deepEqual(out, [])
})

test('an empty tick produces nothing', () => {
  assert.deepEqual(selectCancellationAlerts([], new Map()), [])
})
