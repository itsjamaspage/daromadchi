// Locks the two payout display-accuracy bugs shut. Pure functions, no DB.
// Run:  node --import tsx --test lib/db/payout-status.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveUzumBucketStatus,
  deriveYandexSettledStatus,
  isYandexTransferred,
  isYandexAwaitingTransfer,
  yandexFullyTransferred,
  deriveYandexOrderStatus,
  deriveBucketStatusFromOrders,
  sumPaidOrders,
  isPartiallyPaidStatus,
  isPaidStatus,
  isAvailableStatus,
  isPendingStatus,
} from './payout-status'

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

describe('Yandex status — partial netting flagged, NEVER paid (BUG 2)', () => {
  // Credit posted, fee debits not yet posted → net is NOT final. The 100 000 M9 case.
  it('credit>0, debit=0 → fees_pending, counted in pending bucket, not paid', () => {
    const s = deriveYandexSettledStatus(100000, 0)
    assert.equal(s, 'fees_pending')
    assert.equal(isPaidStatus(s), false)
    assert.equal(isPendingStatus(s), true)
    assert.equal(isAvailableStatus(s), false)
  })

  it('credit>0 and debits present → pending (fees final)', () => {
    assert.equal(deriveYandexSettledStatus(100000, 16060), 'pending')
  })

  it('NEVER emits paid from a settled Yandex bucket (no calendar paid)', () => {
    assert.equal(isPaidStatus(deriveYandexSettledStatus(100000, 0)), false)
    assert.equal(isPaidStatus(deriveYandexSettledStatus(100000, 16060)), false)
  })
})

describe('Yandex netting transfer signal — "paid" IS provable (PROBLEM 1)', () => {
  // The confirmed example: order 59564845443 → «Переведён по графику выплат», п/п №92735.
  it('«Переведён по графику выплат» + payment-order number → transferred → paid', () => {
    assert.equal(isYandexTransferred('Переведён по графику выплат', '92735'), true)
    assert.equal(deriveYandexSettledStatus(59940, 0, true), 'paid')
    assert.equal(isPaidStatus(deriveYandexSettledStatus(59940, 0, true)), true)
  })

  // Order 60137441539 (M9) → «Будет переведён по графику выплат», no п/п → still pending.
  it('«Будет переведён по графику выплат» (no п/п) → NOT transferred, NOT paid', () => {
    assert.equal(isYandexTransferred('Будет переведён по графику выплат', null), false)
    assert.equal(isYandexAwaitingTransfer('Будет переведён по графику выплат'), true)
    assert.equal(isPaidStatus(deriveYandexSettledStatus(100000, 16000, false)), false)
  })

  it('«Переведён» WITHOUT a payment-order number is not proof of transfer', () => {
    assert.equal(isYandexTransferred('Переведён по графику выплат', null), false)
    assert.equal(isYandexTransferred('Переведён по графику выплат', '  '), false)
  })

  it('handles the е/ё spelling of переведен/переведён', () => {
    assert.equal(isYandexTransferred('Переведен по графику выплат', '92735'), true)
  })

  it('transferPosted=false keeps the existing fees_pending / pending behavior', () => {
    assert.equal(deriveYandexSettledStatus(100000, 0, false), 'fees_pending')
    assert.equal(deriveYandexSettledStatus(100000, 16060, false), 'pending')
    assert.equal(deriveYandexSettledStatus(100000, 0), 'fees_pending') // default arg
  })
})

describe('«Переводятся» — in transit is NOT transferred', () => {
  // The exact wording that produced the overstatement. Yandex reported
  // 32 940 transferred and 100 000 still «Переводятся»; the app showed 59 940
  // paid, because this status matched neither classifier and so blocked
  // nothing.
  //
  // «Переводятся» shares no stem with «переведён»: перевод- vs перевед-. And it
  // carries no «будет». That is why BOTH of the old checks answered no.
  const IN_TRANSIT = 'Переводятся'

  it('is not counted as transferred, even with a payment-order number', () => {
    assert.equal(isYandexTransferred(IN_TRANSIT, '92735'), false)
  })

  it('is not recognised as awaiting either — which is exactly the trap', () => {
    assert.equal(isYandexAwaitingTransfer(IN_TRANSIT), false)
  })

  it('the OLD rule called such a bucket paid; the new one does not', () => {
    // One row genuinely transferred, two still in transit: 3 transactions.
    const txnCount = 3, transferred = 1, awaitingRecognised = 0

    const oldRule = transferred > 0 && awaitingRecognised === 0
    assert.equal(oldRule, true, 'reproduces the bug: the old guard passed')
    assert.equal(deriveYandexSettledStatus(176_000, 0, oldRule), 'paid')

    const newRule = yandexFullyTransferred(txnCount, transferred)
    assert.equal(newRule, false)
    const status = deriveYandexSettledStatus(176_000, 0, newRule)
    assert.equal(isPaidStatus(status), false, 'in-transit money must not read as paid')
  })

  it('a bucket where every row IS transferred still reads paid', () => {
    assert.equal(yandexFullyTransferred(3, 3), true)
    assert.equal(deriveYandexSettledStatus(176_000, 1_000, true), 'paid')
  })

  it('any unclassifiable status keeps the bucket out of paid', () => {
    // The point of positive proof: a wording nobody has seen yet fails closed.
    for (const unknown of ['Переводятся', 'В обработке', 'На согласовании', '']) {
      assert.equal(isYandexTransferred(unknown, '92735'), false, unknown)
    }
    assert.equal(yandexFullyTransferred(2, 1), false)
  })

  it('an empty bucket is never paid', () => {
    assert.equal(yandexFullyTransferred(0, 0), false)
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
  // The two orders from the report that produced this fix.
  const PAID_ORDER    = { number: '59564845443', net: 59_940, transferred: true }   // п/п 92735
  const PENDING_ORDER = { number: '60137441539', net: 100_000, transferred: false } // «Будет переведён», no п/п

  it('an order carrying a payment-order number is paid', () => {
    // The п/п IS the bank reference: it exists because the money moved.
    assert.equal(isYandexTransferred('Переведён по графику выплат', '92735'), true)
    assert.equal(deriveYandexOrderStatus(PAID_ORDER.transferred), 'paid')
  })

  it('an order without one is pending, whatever its month is doing', () => {
    assert.equal(isYandexTransferred('Будет переведён по графику выплат', null), false)
    assert.equal(deriveYandexOrderStatus(PENDING_ORDER.transferred), 'pending')
  })

  it('the mixed bucket reports exactly 59 940 paid and 100 000 pending', () => {
    // The case BOTH previous versions got wrong, in opposite directions:
    // before, the whole 159 940 read as paid; after the strict fix, none of it
    // did. The truth is one of each.
    const orders = [PAID_ORDER, PENDING_ORDER].map(o => ({
      net: o.net, status: deriveYandexOrderStatus(o.transferred),
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
      { net: 10_000, status: deriveYandexOrderStatus(true) },
      { net: 20_000, status: deriveYandexOrderStatus(true) },
    ]
    assert.equal(deriveBucketStatusFromOrders(orders, 'pending'), 'paid')
    assert.equal(sumPaidOrders(orders), 30_000)
  })

  it('a month where nothing transferred keeps the transaction-level fallback', () => {
    const orders = [
      { net: 10_000, status: deriveYandexOrderStatus(false) },
      { net: 20_000, status: deriveYandexOrderStatus(false) },
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
