/**
 * "Should we tell the seller this order was cancelled?"
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 * The new-order alert says «🛒 Новый заказ — нужно собрать и отправить» and
 * then never speaks again. A prepaid order can be paid, announced, and then
 * cancelled before delivery — order 60810362177 did exactly that. The seller
 * goes to their marketplace account to pick and pack, finds nothing, and has
 * no way to tell whether the app was wrong or the order vanished.
 *
 * Being told to act and never told to stop is worse than not being told at
 * all, because it costs the seller a trip.
 *
 * ── The rule, and why each clause is there ──────────────────────────────────
 *  1. We ANNOUNCED it (alert_sent_at set). Without this the seller would get a
 *     cancellation notice for every order they never heard about — most
 *     cancellations are buyers changing their mind minutes after ordering, and
 *     a shop can carry a steady trickle of them. The notice is the closing
 *     bracket of a message we already sent; with no opening bracket there is
 *     nothing to close.
 *  2. It is cancelled or returned NOW.
 *  3. We have not already said so (cancel_alert_sent_at unset). The syncs are
 *     stateless across ticks and re-read the same window every five minutes,
 *     so without a marker this repeats forever.
 *
 * No previous status is needed. "Cancelled and unannounced" is enough, and it
 * is idempotent by construction — which matters more than detecting the exact
 * moment of transition, because a tick can miss one.
 *
 * ── Why the NORMALIZED status here, when #299 forbade it ────────────────────
 * #299's rule is that "should the seller act?" must never be decided from the
 * normalized enum, because an unmapped status falls through `?? 'pending'`
 * INTO the actionable bucket — that is how an unpaid order was announced as
 * ready to ship.
 *
 * The risk here runs the other way. An unmapped status also falls into
 * 'pending', which is NOT cancelled, so an unrecognised value produces
 * silence rather than a false alarm. Failing quiet is the safe direction for
 * this one, and the normalized enum is the only field both marketplaces
 * express cancellation in identically.
 */

/** Normalized statuses that mean the order will not be fulfilled. */
export const CANCELLED_STATUSES = ['cancelled', 'returned'] as const

export interface CancellableOrder {
  /** External marketplace order id, used for the message line. */
  order_id_external: string
  /** Current normalized status. */
  status: string
  /** Non-null once the "new order" alert went out for this order. */
  alert_sent_at?: Date | string | null
  /** Non-null once the cancellation notice went out. */
  cancel_alert_sent_at?: Date | string | null
}

export function isCancelledStatus(status: string | null | undefined): boolean {
  return (CANCELLED_STATUSES as readonly string[]).includes(status ?? '')
}

/** True when this order needs a cancellation notice on this tick. */
export function needsCancellationAlert(o: CancellableOrder): boolean {
  if (o.alert_sent_at == null) return false          // never announced → nothing to retract
  if (o.cancel_alert_sent_at != null) return false   // already said so
  return isCancelledStatus(o.status)
}

/**
 * The orders to announce as cancelled, from everything seen this tick.
 *
 * Takes the CURRENT status from the freshly-synced rows and the two markers
 * from what is already stored, because a cancellation usually arrives as an
 * UPDATE to a row we inserted earlier — the same reason the new-order gate had
 * to stop looking only at inserts (#306).
 */
export function selectCancellationAlerts<T extends { order_id_external: string; status: string }>(
  synced: T[],
  markers: Map<string, { alert_sent_at: Date | null; cancel_alert_sent_at: Date | null }>,
): T[] {
  return synced.filter(r => {
    const m = markers.get(r.order_id_external)
    if (!m) return false      // no stored row → it was never announced
    return needsCancellationAlert({
      order_id_external: r.order_id_external,
      status: r.status,
      alert_sent_at: m.alert_sent_at,
      cancel_alert_sent_at: m.cancel_alert_sent_at,
    })
  })
}
