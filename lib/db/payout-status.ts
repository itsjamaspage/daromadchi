/**
 * Pure payout-status derivation — NO db, NO network, NO React. Safe to import
 * from both the server aggregation (lib/db/payouts.ts) and the client view
 * (components/dashboard/PayoutsView.tsx). Type-only import, erased at build.
 *
 * The whole point: status is driven by REAL marketplace signals, never the
 * calendar. See docs/plans/payouts-settlement-accuracy.md.
 */
import type { PayoutStatus } from '@/lib/types'

/**
 * Uzum monthly-bucket status, rolled up from its orders' /v1/finance/orders
 * statuses. Enum: TO_WITHDRAW | PROCESSING | CANCELED | PARTIALLY_CANCELLED.
 * CANCELED is excluded upstream (shown in returns).
 *
 *   any TO_WITHDRAW present → available_to_withdraw  (earned, withdrawable, NOT withdrawn)
 *   else                    → pending
 *
 * NEVER 'paid': Uzum exposes no completed-withdrawal signal to this token
 * (payout-history is 403 RBAC), so "paid" is unprovable and must not be emitted.
 * An empty bucket defaults to pending (the safe, less-advanced side).
 */
export function deriveUzumBucketStatus(orderStatuses: readonly string[]): PayoutStatus {
  return orderStatuses.some((s) => s === 'TO_WITHDRAW') ? 'available_to_withdraw' : 'pending'
}

/**
 * Whether a Yandex netting transaction represents money ALREADY TRANSFERRED to
 * the seller. The united-netting report's "Статус" column reads
 * «Переведён по графику выплат» once a payment order has been issued, and carries
 * a payment-order number («Номер платежного поручения»). Both must be present:
 * the status text alone (without a п/п number) is not proof of transfer.
 *
 * «Будет переведён по графику выплат» (future) also contains "перевед" — it is
 * excluded by the "будет" guard, and it never carries a payment-order number.
 */
export function isYandexTransferred(
  statusNote: string | null | undefined,
  paymentOrderNumber: string | null | undefined,
): boolean {
  const s = (statusNote ?? '').toLowerCase()
  const transferred = s.includes('перевед') && !s.includes('будет') // «Переведён…», not «Будет переведён…»
  const hasPaymentOrder = !!(paymentOrderNumber && String(paymentOrderNumber).trim())
  return transferred && hasPaymentOrder
}

/**
 * Whether a Yandex netting transaction is still AWAITING transfer
 * («Будет переведён по графику выплат»).
 *
 * Kept for what it describes, but it is NO LONGER what decides "paid" — see
 * yandexFullyTransferred below. Counting only the statuses we recognise as
 * awaiting meant any wording we had not thought of counted as neither, and a
 * bucket holding it was free to call itself paid. «Переводятся» (in transit) is
 * exactly that: it shares no stem with «переведён» (перевод vs перевед) and has
 * no «будет», so it slipped through both.
 */
export function isYandexAwaitingTransfer(statusNote: string | null | undefined): boolean {
  const s = (statusNote ?? '').toLowerCase()
  return s.includes('будет') && s.includes('перевед') // «Будет переведён…»
}

/**
 * Is EVERY transaction in this bucket proven transferred?
 *
 * This replaces "has a transfer and nothing recognisably awaiting" with positive
 * proof, and the difference is the bug it fixes. The old rule asked what we could
 * recognise as NOT yet sent; anything unrecognised — a status wording nobody had
 * seen, «Переводятся» above all — answered "no", and the bucket called itself
 * paid. In the report that produced this fix, 32 940 genuinely transferred and
 * 100 000 still in transit were shown to the seller as 59 940 paid.
 *
 * Now a bucket is paid only when the count of transferred transactions equals
 * the count of transactions in it. A row we cannot classify keeps the whole
 * bucket out of "paid", which is the direction that can only ever understate
 * what the seller has been sent.
 *
 * Both counts come from the same loop over the same rows in payouts.ts, so they
 * cannot drift apart.
 */
export function yandexFullyTransferred(txnCount: number, transferredCount: number): boolean {
  if (txnCount <= 0) return false
  return transferredCount >= txnCount
}

/**
 * Yandex settled-bucket status, driven by the netting report — NEVER the calendar.
 *
 *   transferPosted (EVERY transaction proven transferred) → paid
 *   else credit > 0 AND debit == 0 → fees_pending  (net not final; flagged, in pending bucket)
 *   else                          → pending        (fees final, transfer not yet posted)
 *
 * `transferPosted` is rolled up in payouts.ts via yandexFullyTransferred().
 * Defaults to false so existing callers (and pre-payment-order data) behave as before.
 */
export function deriveYandexSettledStatus(credit: number, debit: number, transferPosted = false): PayoutStatus {
  if (transferPosted) return 'paid'
  return credit > 0 && debit === 0 ? 'fees_pending' : 'pending'
}

// ── KPI bucket classifiers (shared by PayoutsView totals) ────────────────────
// Three mutually-exclusive display buckets: paid / available / pending.

/** Money proven to have left the marketplace to the seller. Not emitted today. */
export function isPaidStatus(s: PayoutStatus): boolean {
  return s === 'paid' || s === 'estimated_paid'
}

/** Earned & withdrawable but not yet withdrawn (Uzum TO_WITHDRAW). */
export function isAvailableStatus(s: PayoutStatus): boolean {
  return s === 'available_to_withdraw'
}

/** In-progress: pending, fees-not-final, or estimated-pending. Includes legacy 'processing'. */
export function isPendingStatus(s: PayoutStatus): boolean {
  return s === 'pending' || s === 'fees_pending' || s === 'estimated_pending' || s === 'processing'
}
