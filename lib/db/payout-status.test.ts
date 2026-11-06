// Locks the two payout display-accuracy bugs shut. Pure functions, no DB.
// Run:  node --import tsx --test lib/db/payout-status.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveUzumBucketStatus,
  deriveBucketStatusFromOrders,
  sumPaidOrders,
  isPartiallyPaidStatus,
  isPaidStatus,
  isAvailableStatus,
  isPendingStatus,
  rollUpUzumOrderStatus,
  isUzumOrderStatus,
} from './payout-status'
import type { PayoutStatus } from '@/lib/types'

describe('Uzum status — available vs pending, NEVER paid (BUG 1)', () => {
  // THE test that matters most: an available-to-withdraw balance must never
  // render as paid. This is the exact 55 550 J16 (order 117751391) lie.
  it('TO_WITHDRAW → available_to_withdraw, and is NOT paid', () => {
    const s = deriveUzumBucketStatus(['TO_WITHDRAW'])
    assert.equal(s, 'available_to_withdraw')
    assert.equal(isPaidStatus(s), false)
    assert.equal(isAvailableStatus(s), true)
  })

  it('all PROCESSING → pending', () => {
    assert.equal(deriveUzumBucketStatus(['PROCESSING', 'PROCESSING']), 'pending')
  })

  it('mixed PROCESSING + TO_WITHDRAW rolls up to available_to_withdraw', () => {
    assert.equal(deriveUzumBucketStatus(['PROCESSING', 'TO_WITHDRAW']), 'available_to_withdraw')
  })

  it('NEVER emits paid for ANY Uzum order-status combination', () => {
    for (const combo of [['TO_WITHDRAW'], ['PROCESSING'], ['PROCESSING', 'TO_WITHDRAW'], ['PARTIALLY_CANCELLED'], []]) {
      assert.equal(isPaidStatus(deriveUzumBucketStatus(combo)), false, `combo ${JSON.stringify(combo)} must not be paid`)
    }
  })

  it('empty bucket defaults to pending (safe, less-advanced side)', () => {
    assert.equal(deriveUzumBucketStatus([]), 'pending')
  })
})

describe('no settlement data means pending, never paid-by-age', () => {
  // The second bug: a month bucket with no settlement rows used to be marked
  // 'estimated_paid' purely because the month had ended. Age is not a
  // settlement signal — a Uzum payout that failed and was reversed still showed
  // as «Выплачено» through this path.
  it('estimated_paid is still counted as paid, which is why it must not be emitted', () => {
    assert.equal(isPaidStatus('estimated_paid'), true)
  })

  it('the fallback statuses now in use are both pending-side', () => {
    for (const s of ['pending', 'estimated_pending'] as const) {
      assert.equal(isPaidStatus(s), false)
      assert.equal(isPendingStatus(s), true)
    }
  })
})

describe('per-order settlement — the real seller data', () => {
  // A transfer signal on the ORDER, not the month. Modelled on the two orders
  // from the report that produced this fix: one proven transferred, one not.
  // The marketplace that supplied that signal is gone, but the roll-up rules it
  // forced are what the Payouts tiles still sum, so they stay tested.
  const orderStatus = (transferred: boolean): PayoutStatus => transferred ? 'paid' : 'pending'
  const PAID_ORDER    = { number: '59564845443', net: 59_940, transferred: true }
  const PENDING_ORDER = { number: '60137441539', net: 100_000, transferred: false }

  it('the mixed bucket reports exactly 59 940 paid and 100 000 pending', () => {
    // The case BOTH previous versions got wrong, in opposite directions:
    // before, the whole 159 940 read as paid; after the strict fix, none of it
    // did. The truth is one of each.
    const orders = [PAID_ORDER, PENDING_ORDER].map(o => ({
      net: o.net, status: orderStatus(o.transferred),
    }))
    const bucketNet = orders.reduce((s, o) => s + o.net, 0)

    const paid = sumPaidOrders(orders)
    assert.equal(paid, 59_940, 'paid total is the transferred order only')
    assert.equal(bucketNet - paid, 100_000, 'and the remainder stays pending')

    const status = deriveBucketStatusFromOrders(orders, 'pending')
    assert.equal(status, 'partially_paid')
    assert.equal(isPaidStatus(status), false, 'a mixed month must not inflate the paid tile')
    assert.equal(isPendingStatus(status), false, 'nor be counted whole into pending')
    assert.equal(isPartiallyPaidStatus(status), true)
  })

  it('a month where every order transferred is simply paid', () => {
    const orders = [
      { net: 10_000, status: orderStatus(true) },
      { net: 20_000, status: orderStatus(true) },
    ]
    assert.equal(deriveBucketStatusFromOrders(orders, 'pending'), 'paid')
    assert.equal(sumPaidOrders(orders), 30_000)
  })

  it('a month where nothing transferred keeps the transaction-level fallback', () => {
    const orders = [
      { net: 10_000, status: orderStatus(false) },
      { net: 20_000, status: orderStatus(false) },
    ]
    assert.equal(deriveBucketStatusFromOrders(orders, 'fees_pending'), 'fees_pending')
    assert.equal(sumPaidOrders(orders), 0)
  })

  it('a bucket with no order rows falls back rather than inventing a status', () => {
    // Fee-only months carry transactions with no «Номер заказа».
    assert.equal(deriveBucketStatusFromOrders([], 'pending'), 'pending')
    assert.equal(sumPaidOrders([]), 0)
  })

  it('Uzum orders can never reach paid — no per-order transfer signal exists', () => {
    for (const statuses of [['TO_WITHDRAW'], ['PROCESSING'], ['TO_WITHDRAW', 'PROCESSING'], []]) {
      const s = deriveUzumBucketStatus(statuses)
      assert.equal(isPaidStatus(s), false)
      assert.equal(sumPaidOrders([{ net: 50_300, status: s }]), 0,
        'the Uzum 50 300 stays out of the paid total until the RBAC endpoint opens')
    }
  })
})

describe('KPI bucket classifiers are mutually exclusive', () => {
  it('available_to_withdraw is available only (not paid, not pending)', () => {
    assert.deepEqual(
      [isPaidStatus('available_to_withdraw'), isAvailableStatus('available_to_withdraw'), isPendingStatus('available_to_withdraw')],
      [false, true, false],
    )
  })
  it('fees_pending is pending only', () => {
    assert.deepEqual(
      [isPaidStatus('fees_pending'), isAvailableStatus('fees_pending'), isPendingStatus('fees_pending')],
      [false, false, true],
    )
  })
  it('pending is pending only', () => {
    assert.deepEqual(
      [isPaidStatus('pending'), isAvailableStatus('pending'), isPendingStatus('pending')],
      [false, false, true],
    )
  })
})

describe('rollUpUzumOrderStatus — one status for a row of many items', () => {
  it('reports TO_WITHDRAW only when every item reached it', () => {
    assert.equal(rollUpUzumOrderStatus(['TO_WITHDRAW']), 'TO_WITHDRAW')
    assert.equal(rollUpUzumOrderStatus(['TO_WITHDRAW', 'TO_WITHDRAW']), 'TO_WITHDRAW')
  })

  it('lets one unready item speak for the order', () => {
    // The whole point of the rule. "Any TO_WITHDRAW wins" is what the bucket
    // rule did, and it would show an order as ready to withdraw while half of
    // it is still being processed.
    assert.equal(rollUpUzumOrderStatus(['TO_WITHDRAW', 'PROCESSING']), 'PROCESSING')
    assert.equal(rollUpUzumOrderStatus(['PROCESSING', 'TO_WITHDRAW']), 'PROCESSING')
  })

  it('ranks PROCESSING below PARTIALLY_CANCELLED', () => {
    assert.equal(rollUpUzumOrderStatus(['PARTIALLY_CANCELLED', 'PROCESSING']), 'PROCESSING')
    assert.equal(rollUpUzumOrderStatus(['PARTIALLY_CANCELLED', 'TO_WITHDRAW']), 'PARTIALLY_CANCELLED')
  })

  it('describes a part-cancelled order by what is still sellable', () => {
    assert.equal(rollUpUzumOrderStatus(['CANCELED', 'TO_WITHDRAW']), 'TO_WITHDRAW')
    assert.equal(rollUpUzumOrderStatus(['CANCELED', 'PROCESSING']), 'PROCESSING')
  })

  it('reports CANCELED only when nothing is left', () => {
    assert.equal(rollUpUzumOrderStatus(['CANCELED']), 'CANCELED')
    assert.equal(rollUpUzumOrderStatus(['CANCELED', 'CANCELED']), 'CANCELED')
  })

  it('returns null rather than inventing a state', () => {
    assert.equal(rollUpUzumOrderStatus([]), null)
    assert.equal(rollUpUzumOrderStatus(['SOMETHING_NEW']), null)
    // An unknown value must not drag a known one down either — it is ignored,
    // not treated as "least advanced".
    assert.equal(rollUpUzumOrderStatus(['SOMETHING_NEW', 'TO_WITHDRAW']), 'TO_WITHDRAW')
  })

  it('guards the DB text column', () => {
    assert.equal(isUzumOrderStatus('TO_WITHDRAW'), true)
    assert.equal(isUzumOrderStatus('WITHDRAWN'), false)   // never existed
    assert.equal(isUzumOrderStatus(null), false)
    assert.equal(isUzumOrderStatus(''), false)
  })
})
