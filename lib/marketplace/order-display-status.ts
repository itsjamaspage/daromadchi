/**
 * What to CALL an order on screen. Pure: no DB, no network.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * The `confirmed` enum value covers two different things on Yandex. PROCESSING
 * means the seller is still packing — Yandex's own UI says «Обрабатывается ·
 * Готов к отгрузке» — while DELIVERY and PICKUP mean the parcel has actually
 * left. All three rendered as «Yo'lda» / "In transit", so an order still sitting
 * on the seller's desk told them it was on its way to the customer (order
 * 60870363586).
 *
 * Uzum never had the problem: its map already files packing states under
 * `pending` and only DELIVERING / ACCEPTED_AT_DP under `confirmed`. That is why
 * the two marketplaces disagreed about what "confirmed" meant, and why this
 * splits the DISPLAY rather than the stored enum — the enum is right for
 * filtering and P&L, and changing it would need a migration plus a sweep of
 * every consumer to fix a label.
 *
 * So: the stored status decides the lifecycle, and the raw marketplace status —
 * already on the row as orders.marketplace_status — decides which of the two
 * `confirmed` meanings to show. A raw value we do not recognise falls back to
 * "preparing", the cautious half: telling a seller their parcel has NOT shipped
 * when it has costs them a glance at the marketplace, while the reverse costs
 * them a missed shipment.
 */

export type OrderDisplayStatus =
  | 'pending'    // seller has it, has not started
  | 'preparing'  // being packed / ready to hand over, NOT shipped
  | 'shipping'   // actually on the way, or waiting at the pickup point
  | 'delivered'
  | 'cancelled'

/**
 * Raw marketplace statuses that mean the parcel has genuinely left the seller.
 * Yandex: DELIVERY «передан в службу доставки», PICKUP «доставлен в пункт
 * выдачи». Uzum: DELIVERING, ACCEPTED_AT_DP, plus the defensive aliases its own
 * map already treats as shipped.
 */
const SHIPPED_RAW = new Set([
  'DELIVERY', 'PICKUP',
  'DELIVERING', 'ACCEPTED_AT_DP',
  'SENT', 'HANDED_OVER', 'TRANSFERRED', 'ON_DELIVERY',
])

/** Raw statuses that explicitly mean "still with the seller". */
const PREPARING_RAW = new Set([
  'PROCESSING', 'PACKING', 'PACKED', 'PACKAGED', 'ASSEMBLED',
  'READY', 'IN_PROGRESS', 'PENDING_DELIVERY',
])

export function orderDisplayStatus(
  status: string | null | undefined,
  marketplaceStatus?: string | null,
): OrderDisplayStatus {
  if (status === 'cancelled' || status === 'returned') return 'cancelled'
  if (status === 'delivered') return 'delivered'

  const raw = (marketplaceStatus ?? '').trim().toUpperCase()
  if (raw && SHIPPED_RAW.has(raw)) return 'shipping'
  if (raw && PREPARING_RAW.has(raw)) return 'preparing'

  // No usable raw value: fall back to what the enum says. `confirmed` without
  // evidence of shipment is the cautious "preparing", never "on the way".
  if (status === 'confirmed') return 'preparing'
  return 'pending'
}
