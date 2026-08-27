// Pure on-hand ledger logic — Option A (debit at placement) + sellable-only
// returns. Run: node --import tsx --test lib/marketplace/stock-ledger.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ledgerOnHand, availableFromOnHand, diffLedger, ledgerKey, orderLedgerStatus,
  type LedgerEvent, type GroupOrder, type PendingLedgerWrite,
} from './stock-ledger'

const seed = (n: number): LedgerEvent => ({ delta: n, reason: 'seed' })
const keysOf = (writes: PendingLedgerWrite[]) =>
  new Set(writes.map(w => ledgerKey(w.reason, w.orderIdExternal)))
// Apply a diff's writes into a recorded-key set (simulates persistence).
const applied = (prev: Set<string>, writes: PendingLedgerWrite[]) =>
  new Set<string>([...prev, ...keysOf(writes)])

const live = (id: string, qty = 1): GroupOrder =>
  ({ orderIdExternal: id, marketplace: 'yandex_market', qty, status: 'live' })
const cancelled = (id: string, qty = 1): GroupOrder =>
  ({ orderIdExternal: id, marketplace: 'yandex_market', qty, status: 'cancelled' })
const returned = (id: string, restockable: boolean, qty = 1): GroupOrder =>
  ({ orderIdExternal: id, marketplace: 'yandex_market', qty, status: 'returned', restockable })

describe('ledgerOnHand / availableFromOnHand', () => {
  it('sums deltas to the on-hand balance', () => {
    assert.equal(ledgerOnHand([seed(2), { delta: -1, reason: 'consume', orderIdExternal: 'o1' }]), 1)
    assert.equal(ledgerOnHand([]), 0)
    assert.equal(ledgerOnHand([seed(2), { delta: -1, reason: 'consume' }, { delta: 1, reason: 'cancel' }]), 2)
  })
  it('available is the on-hand clamped at zero', () => {
    assert.equal(availableFromOnHand(1), 1)
    assert.equal(availableFromOnHand(0), 0)
    assert.equal(availableFromOnHand(-4), 0)
  })
})

describe('diffLedger — Option A (debit at placement)', () => {
  it('THE JMBLK case: seed 2, one live Yandex order → consume −1 → on-hand 1', () => {
    // Both listing pools were stale-high at 2; the ledger is what actually debits.
    const events: LedgerEvent[] = [seed(2)]
    const writes = diffLedger([live('60137441539')], new Set())
    assert.deepEqual(writes, [{ delta: -1, reason: 'consume', orderIdExternal: '60137441539', marketplace: 'yandex_market' }])
    const onHand = ledgerOnHand([...events, ...writes.map(w => ({ delta: w.delta, reason: w.reason }))])
    assert.equal(onHand, 1)
    assert.equal(availableFromOnHand(onHand), 1)   // NOT the stale 2
  })

  it('is idempotent — a recorded consume is never re-emitted on re-sync', () => {
    const first = diffLedger([live('o1')], new Set())
    assert.equal(first.length, 1)
    const rec = applied(new Set(), first)
    assert.deepEqual(diffLedger([live('o1')], rec), [])          // same order, still live → no-op
    assert.deepEqual(diffLedger([live('o1', 1)], rec), [])       // re-seen again → no-op
  })

  it('cancel AFTER a consume credits the unit back (+qty), once', () => {
    const rec = applied(new Set(), diffLedger([live('o1')], new Set()))  // consumed
    const credit = diffLedger([cancelled('o1')], rec)
    assert.deepEqual(credit, [{ delta: 1, reason: 'cancel', orderIdExternal: 'o1', marketplace: 'yandex_market' }])
    const rec2 = applied(rec, credit)
    assert.deepEqual(diffLedger([cancelled('o1')], rec2), [])    // idempotent
  })

  it('cancel of an order NEVER consumed is a no-op (first-seen already cancelled)', () => {
    assert.deepEqual(diffLedger([cancelled('ghost')], new Set()), [])
  })

  it('return credits back ONLY when restockable (sellable-only)', () => {
    const rec = applied(new Set(), diffLedger([live('o1')], new Set()))  // consumed
    assert.deepEqual(diffLedger([returned('o1', true)], rec),
      [{ delta: 1, reason: 'return', orderIdExternal: 'o1', marketplace: 'yandex_market' }])
    assert.deepEqual(diffLedger([returned('o1', false)], rec), [])       // write-off → no credit
  })

  it('return is idempotent and never fires without a prior consume', () => {
    const rec = applied(new Set(), diffLedger([live('o1')], new Set()))
    const rec2 = applied(rec, diffLedger([returned('o1', true)], rec))
    assert.deepEqual(diffLedger([returned('o1', true)], rec2), [])       // already credited
    assert.deepEqual(diffLedger([returned('ghost', true)], new Set()), []) // never consumed
  })

  it('multi-unit order debits the full quantity', () => {
    assert.deepEqual(diffLedger([live('o1', 3)], new Set()),
      [{ delta: -3, reason: 'consume', orderIdExternal: 'o1', marketplace: 'yandex_market' }])
  })

  it('full lifecycle nets to zero: seed 2, sell 1, return-restock → back to 2', () => {
    const events: LedgerEvent[] = [seed(2)]
    let rec = new Set<string>()
    for (const w of diffLedger([live('o1')], rec)) events.push({ delta: w.delta, reason: w.reason })
    rec = applied(rec, diffLedger([live('o1')], new Set()))
    assert.equal(ledgerOnHand(events), 1)
    for (const w of diffLedger([returned('o1', true)], rec)) events.push({ delta: w.delta, reason: w.reason })
    assert.equal(ledgerOnHand(events), 2)
    assert.equal(availableFromOnHand(ledgerOnHand(events)), 2)
  })
})

describe('orderLedgerStatus — live is anchored to RESERVING_RAW_STATUSES (flag #1)', () => {
  it('paid & committed raw statuses are live (consume a unit)', () => {
    // Uzum
    for (const raw of ['PACKING', 'PENDING_DELIVERY', 'DELIVERING', 'ACCEPTED_AT_DP']) {
      assert.equal(orderLedgerStatus(raw, 'pending'), 'live', raw)
    }
    // Yandex
    for (const raw of ['PROCESSING', 'DELIVERY', 'PICKUP']) {
      assert.equal(orderLedgerStatus(raw, 'confirmed'), 'live', raw)
    }
  })

  it('UNPAID DRAFTS never debit the pool → null (the reserve-at-payment guarantee)', () => {
    // Uzum freshly-placed / unpaid; Yandex pre-payment states. All normalize to
    // 'pending', none are in the reserving set → nothing recorded.
    for (const raw of ['CREATED', 'NEW', 'PENDING']) {
      assert.equal(orderLedgerStatus(raw, 'pending'), null, raw)
    }
    for (const raw of ['UNPAID', 'PLACING', 'RESERVED']) {
      assert.equal(orderLedgerStatus(raw, 'pending'), null, raw)
    }
  })

  it('delivered (collected) stays live — Option A keeps the consumed unit debited', () => {
    assert.equal(orderLedgerStatus('DELIVERED', 'delivered'), 'live')
    assert.equal(orderLedgerStatus(null, 'delivered'), 'live')   // first-seen-delivered still debits
  })

  it('cancelled and returned map to their credit reasons', () => {
    assert.equal(orderLedgerStatus('CANCELLED', 'cancelled'), 'cancelled')
    assert.equal(orderLedgerStatus('RETURNED', 'returned'), 'returned')
    // A cancel FROM a reserving state is still a cancel (credit back), not live.
    assert.equal(orderLedgerStatus('PACKING', 'cancelled'), 'cancelled')
  })

  it('the mapping feeds diffLedger: a draft is dropped before it can consume', () => {
    // Only orders with a non-null status become GroupOrders; a draft never does,
    // so diffLedger never sees it and the pool is never debited by an unpaid order.
    const raws = [
      { raw: 'PACKING', norm: 'pending' },   // live
      { raw: 'CREATED', norm: 'pending' },   // draft → dropped
    ]
    const groupOrders: GroupOrder[] = raws
      .map((r, i) => {
        const s = orderLedgerStatus(r.raw, r.norm)
        return s ? { orderIdExternal: `o${i}`, marketplace: 'uzum' as const, qty: 1, status: s } : null
      })
      .filter((o): o is GroupOrder => o !== null)
    assert.equal(groupOrders.length, 1)
    const writes = diffLedger(groupOrders, new Set())
    assert.equal(writes.length, 1)
    assert.equal(writes[0].reason, 'consume')
    assert.equal(writes[0].delta, -1)
  })
})
