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
 * Yandex settled-bucket status. Yandex's netting report posts the credit
 * (Начисление) before the fee debits (Удержания), so a bucket can be "settled"
 * with credit only:
 *
 *   credit > 0 AND debit == 0 → fees_pending  (net not final; stays in pending bucket, flagged)
 *   else                      → pending        (fees final)
 *
 * NEVER calendar-'paid' — there is no order-level Yandex withdrawal feed, so a
 * settled row reads as pending/awaiting payout, not "paid".
 */
export function deriveYandexSettledStatus(credit: number, debit: number): PayoutStatus {
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
