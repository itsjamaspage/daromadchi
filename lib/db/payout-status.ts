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
 * («Будет переведён по графику выплат»). Used to keep a month bucket out of
 * "paid" while any of its transfers are still scheduled-but-not-sent.
 */
export function isYandexAwaitingTransfer(statusNote: string | null | undefined): boolean {
  const s = (statusNote ?? '').toLowerCase()
  return s.includes('будет') && s.includes('перевед') // «Будет переведён…»
}

/**
 * Yandex settled-bucket status, driven by the netting report — NEVER the calendar.
 *
 *   transferPosted (a payment order issued, none still awaiting) → paid
 *   else credit > 0 AND debit == 0 → fees_pending  (net not final; flagged, in pending bucket)
 *   else                          → pending        (fees final, transfer not yet posted)
 *
 * `transferPosted` is rolled up in payouts.ts from the bucket's transactions:
 * true when at least one is isYandexTransferred and none is isYandexAwaitingTransfer.
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
