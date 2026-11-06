/**
 * Pure payout-status derivation — NO db, NO network, NO React. Safe to import
 * from both the server aggregation (lib/db/payouts.ts) and the client view
 * (components/dashboard/PayoutsView.tsx). Type-only import, erased at build.
 *
 * The whole point: status is driven by REAL marketplace signals, never the
 * calendar. See docs/plans/payouts-settlement-accuracy.md.
 */
import type { PayoutStatus, UzumOrderStatus } from '@/lib/types'

/**
 * Uzum monthly-bucket status, rolled up from its orders' /v1/finance/orders
 * statuses. Enum: TO_WITHDRAW | PROCESSING | CANCELED | PARTIALLY_CANCELLED.
 * CANCELED is excluded upstream (shown in returns).
 *
 *   any TO_WITHDRAW present → available_to_withdraw  (earned; withdrawal state UNKNOWN)
 *   else                    → pending
 *
 * NEVER 'paid': Uzum exposes no completed-withdrawal signal to this token
 * (payout-history is 403 RBAC), so "paid" is unprovable and must not be emitted.
 * An empty bucket defaults to pending (the safe, less-advanced side).
 */
export function deriveUzumBucketStatus(orderStatuses: readonly string[]): PayoutStatus {
  return orderStatuses.some((s) => s === 'TO_WITHDRAW') ? 'available_to_withdraw' : 'pending'
}

/* ── Uzum's own order status (display) ─────────────────────────────────────── */

/** The complete /v1/finance/orders enum. Runtime guard for a text DB column. */
const UZUM_ORDER_STATUSES: readonly UzumOrderStatus[] = [
  'TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED',
]

export function isUzumOrderStatus(s: string | null | undefined): s is UzumOrderStatus {
  return !!s && (UZUM_ORDER_STATUSES as readonly string[]).includes(s)
}

/**
 * One Uzum status for a row that may cover SEVERAL order-items.
 *
 * The status Uzum reports is per order-ITEM (the settlement table is unique on
 * order_item_id), while a payouts row is an order — and a period row is a whole
 * month of them. A two-product order can hold two different states, so a rule is
 * needed and "take the first" would be a coin toss.
 *
 * The rule is LEAST-ADVANCED WINS, ranked by how ready the money is:
 *
 *   PROCESSING  <  PARTIALLY_CANCELLED  <  TO_WITHDRAW
 *
 * so TO_WITHDRAW requires EVERY item to have reached it. That direction is the
 * one this codebase already had to learn: an "any advanced" rule let one row
 * speak for rows that had not moved, and the seller was shown money as sent
 * that was not. Overstating readiness is the error that costs something;
 * understating it is merely conservative.
 *
 * CANCELED is only reported when EVERY item is cancelled — and in practice it
 * cannot reach a badge at all: payouts.ts drops cancelled items before any row
 * is built, because cancellations belong in the returns column. It is handled
 * here so the function is total over the enum rather than silently wrong if
 * that filter ever changes.
 *
 * Returns null when nothing recognisable is present, so the caller keeps its
 * existing PayoutStatus badge instead of inventing a state.
 */
export function rollUpUzumOrderStatus(statuses: readonly string[]): UzumOrderStatus | null {
  const known = statuses.filter(isUzumOrderStatus)
  if (known.length === 0) return null

  // Cancelled items never reach a row today; treat them as absent so a
  // part-cancelled order is described by what remains sellable.
  const live = known.filter(s => s !== 'CANCELED')
  if (live.length === 0) return 'CANCELED'

  if (live.some(s => s === 'PROCESSING')) return 'PROCESSING'
  if (live.some(s => s === 'PARTIALLY_CANCELLED')) return 'PARTIALLY_CANCELLED'
  return 'TO_WITHDRAW'
}

/* ── per-order settlement ──────────────────────────────────────────────────── */

/** The minimum an order needs to be classified and totalled. */
export interface SettledOrder {
  net: number
  status: PayoutStatus
}

/**
 * The month's status, rolled up from its orders.
 *
 * Reports `partially_paid` rather than picking a side, because picking a side is
 * what produced both bugs: a mixed month called `paid` overstates, called
 * `pending` understates. Falls back to the caller's transaction-level status
 * when there are no per-order rows to roll up (a bucket can carry fee-only
 * transactions with no order number).
 */
export function deriveBucketStatusFromOrders(
  orders: readonly SettledOrder[],
  fallback: PayoutStatus,
): PayoutStatus {
  if (orders.length === 0) return fallback
  const paid = orders.filter(o => isPaidStatus(o.status)).length
  if (paid === 0) return fallback
  return paid === orders.length ? 'paid' : 'partially_paid'
}

/**
 * Money proven transferred, summed from ORDERS rather than whole months.
 *
 * This is the number the "Всего выплачено" tile shows. Summing whole buckets is
 * what made a part-paid month contribute either all of its net or none of it;
 * summing the orders inside it contributes exactly the part that moved.
 */
export function sumPaidOrders(orders: readonly SettledOrder[]): number {
  return orders.reduce((total, o) => total + (isPaidStatus(o.status) ? o.net : 0), 0)
}

// ── KPI bucket classifiers (shared by PayoutsView totals) ────────────────────
// Three mutually-exclusive display buckets: paid / available / pending.

/** Money proven to have left the marketplace to the seller. Not emitted today. */
export function isPaidStatus(s: PayoutStatus): boolean {
  return s === 'paid' || s === 'estimated_paid'
}

/**
 * Earned, with the withdrawal state unknown (Uzum TO_WITHDRAW).
 *
 * The enum value still reads available_to_withdraw for compatibility, but the
 * claim it once made — "not yet withdrawn" — was wrong: Uzum reports no
 * withdrawal signal, and money in this state has demonstrably reached a seller's
 * bank while still counted here. The UI says "earned" for that reason.
 */
export function isAvailableStatus(s: PayoutStatus): boolean {
  return s === 'available_to_withdraw'
}

/**
 * In-progress: pending, fees-not-final, or estimated-pending. Includes legacy
 * 'processing'.
 *
 * `partially_paid` is deliberately in NEITHER this nor isPaidStatus. Its month
 * holds both, so counting the whole bucket in either tile would restate the very
 * error this split exists to remove — the paid tile sums orders, and the pending
 * tile counts only months with nothing transferred.
 */
export function isPendingStatus(s: PayoutStatus): boolean {
  return s === 'pending' || s === 'fees_pending' || s === 'estimated_pending' || s === 'processing'
}

/** A month that is part transferred, part not. Neither paid nor pending. */
export function isPartiallyPaidStatus(s: PayoutStatus): boolean {
  return s === 'partially_paid'
}
