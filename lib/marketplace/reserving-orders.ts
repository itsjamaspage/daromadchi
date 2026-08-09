/**
 * Single source of truth for the SQL predicate "this order currently RESERVES a
 * physical unit" — used by BOTH the stock writer (lib/marketplace/stock-sync.ts)
 * and the oversell safety net (lib/marketplace/oversell.ts) so the two can never
 * drift out of agreement about when a unit is committed.
 *
 * Keyed off the RAW marketplace status (orders.marketplace_status) because the
 * normalized 5-value enum collapses Uzum's «В поставке» (DELIVERING, in transit
 * to the PVZ) and «Приняты Uzum» (ACCEPTED_AT_DP, PVZ received) both into
 * 'confirmed'. See RESERVING_RAW_STATUSES for the boundary.
 *
 * Transitional fallback: rows synced before orders.marketplace_status existed
 * (migration 054) have it NULL. For those we keep the previous normalized
 * behavior (status = 'confirmed') so nothing briefly un-reserves — and so no
 * oversell window opens — before the next sync backfills the raw status. Once a
 * row is re-synced its raw status is present and takes over precisely.
 */
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { orders } from '@/lib/db'
import { RESERVING_RAW_STATUSES } from '@/lib/marketplace/stock-allocation'

export function reservingOrderCondition(): SQL {
  return or(
    inArray(orders.marketplace_status, [...RESERVING_RAW_STATUSES]),
    and(isNull(orders.marketplace_status), eq(orders.status, 'confirmed')),
  )!
}
