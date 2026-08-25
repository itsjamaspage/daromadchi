/**
 * Single source of truth for the SQL predicate "this order currently RESERVES a
 * physical unit" — used by BOTH the stock writer (lib/marketplace/stock-sync.ts)
 * and the oversell safety net (lib/marketplace/oversell.ts) so the two can never
 * drift out of agreement about when a unit is committed.
 *
 * Keyed off the RAW marketplace status (orders.marketplace_status) because the
 * normalized 5-value enum is too coarse: it cannot separate an unpaid draft from
 * a paid, committed order, which is exactly the boundary the reservation needs
 * (reserve on payment, never on an unpaid draft). See RESERVING_RAW_STATUSES.
 *
 * Transitional fallback: rows synced before orders.marketplace_status existed
 * (migration 054) have it NULL. For those we keep the previous normalized
 * behavior (status = 'confirmed') so nothing briefly un-reserves — and so no
 * oversell window opens — before the next sync backfills the raw status. Once a
 * row is re-synced its raw status is present and takes over precisely. ('confirmed'
 * is the in-transit bucket — a safe, already-paid fallback; it never reserves an
 * unpaid draft, which normalizes to 'pending'.)
 */
import { and, eq, gte, inArray, isNull, notInArray, or, type SQL } from 'drizzle-orm'
import { orders } from '@/lib/db'
import { RESERVING_RAW_STATUSES } from '@/lib/marketplace/stock-allocation'
import { BOUNDED_LOOKBACK_MARKETPLACES, cutoffFor } from '@/lib/marketplace/reserved-display'

export function reservingOrderCondition(): SQL {
  return or(
    inArray(orders.marketplace_status, [...RESERVING_RAW_STATUSES]),
    and(isNull(orders.marketplace_status), eq(orders.status, 'confirmed')),
  )!
}

/**
 * SQL translation of isCorrectable() — see lib/marketplace/reserved-display.ts
 * for why the bound is per-marketplace rather than a flat 30 days.
 */
export function correctableOrderCondition(now: Date): SQL {
  return or(
    notInArray(orders.marketplace, [...BOUNDED_LOOKBACK_MARKETPLACES]),
    gte(orders.ordered_at, cutoffFor(now)),
  )!
}

/**
 * What the DASHBOARD may subtract from a stock number: an order the engine
 * treats as reserving a unit AND that a later sync could still correct.
 *
 * Deliberately narrower than reservingOrderCondition() alone. The engine reads
 * its own condition live on every run, so a stuck row is re-evaluated forever
 * and never accumulates; a displayed number is a subtraction the seller keeps
 * looking at, so a row that can never be corrected must stop counting.
 *
 * `now` is required, not defaulted — a display query that forgets to pass it
 * should not silently pick up a different cutoff than the caller expected.
 */
export function displayReservedCondition(now: Date): SQL {
  return and(reservingOrderCondition(), correctableOrderCondition(now))!
}
