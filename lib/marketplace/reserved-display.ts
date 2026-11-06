/**
 * What the DASHBOARD may subtract from a stock number — the pure predicate
 * behind displayReservedCondition()'s SQL, in the same spirit as
 * physicalStockFromRead() standing behind reconcilePhysicalStock()'s UPDATE.
 *
 * ── Defect 1: two definitions of "reserved" ─────────────────────────────────
 * The display subtracted every order in normalized `pending`/`confirmed`. The
 * stock engine subtracts RESERVING_RAW_STATUSES — the raw statuses that mean a
 * PAID, committed order holds a unit (Uzum PACKING and later). So a brand-new
 * unpaid draft (Uzum CREATED) reduced
 * the number the seller reads, while the engine that actually manages their
 * stock did not consider it to hold a unit. The display over-subtracted against
 * the system's own definition. This module removes that divergence by deferring
 * to the engine.
 *
 * ── Defect 2: unbounded subtraction against a bounded sync ──────────────────
 * Fixing defect 1 does NOT fix this, and it is worth being explicit about why:
 * RESERVING_RAW_STATUSES is the paid/committed set (PACKING, PENDING_DELIVERY,
 * DELIVERING, ACCEPTED_AT_DP, HANDED_OVER, TRANSFERRED) — precisely the
 * in-flight states an order gets STUCK in. A marketplace whose sync asks for
 * orders by CREATION date over a bounded window never re-fetches an order that
 * ages past it, so its status freezes forever and it would subtract from the
 * seller's displayed stock for the life of the account. Narrowing the status
 * set does nothing about that, which is why the bound below exists.
 *
 * ── Why the bound is per-marketplace, and not just "30 days" ────────────────
 * Uzum's order sync sends NO date filter at all — it re-reads every order on
 * every tick, deliberately (lib/uzum/sync.ts:422-429). An Uzum order is
 * therefore always correctable, however old, and ageing one out would stop
 * subtracting a unit that is genuinely held. That direction of error is the
 * dangerous one: it inflates displayed stock and invites an oversell. So the
 * bound applies ONLY to marketplaces whose sync can lose sight of an order.
 */

import type { MarketplaceType } from '@/lib/types'

/**
 * The bounded-window length a marketplace sync would use. An order older than
 * this, on a marketplace listed below, is one the sync will never look at again.
 */
export const ORDER_STATUS_LOOKBACK_DAYS = 30

/**
 * Marketplaces whose order sync re-reads a BOUNDED window by creation date.
 * Membership here is a statement about that marketplace's sync, not about the
 * marketplace itself — add one only when its sync genuinely stops refreshing
 * old orders, because the effect is to stop subtracting them.
 *
 * Empty today: Uzum's sync sends no date filter and re-reads every order on
 * every tick, so every order stays correctable.
 */
export const BOUNDED_LOOKBACK_MARKETPLACES: readonly MarketplaceType[] = []

export function cutoffFor(now: Date): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - ORDER_STATUS_LOOKBACK_DAYS)
  return d
}

/**
 * Can a later sync still correct this order's status?
 *
 * True for everything on an unbounded-sync marketplace, and for anything still
 * inside the lookback window elsewhere. False only for an order that is
 * provably frozen — which is the only case where declining to subtract it is
 * safe rather than optimistic.
 */
export function isCorrectable(
  marketplace: MarketplaceType | string,
  orderedAt: Date,
  now: Date,
): boolean {
  if (!BOUNDED_LOOKBACK_MARKETPLACES.includes(marketplace as MarketplaceType)) return true
  return orderedAt.getTime() >= cutoffFor(now).getTime()
}
