/**
 * Single source of truth for the predicate "this order is waiting for the SELLER
 * to pick, pack and ship it" — the only thing that may trigger the
 * «🛒 Новый заказ — нужно собрать и отправить» Telegram alert.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The alert used to gate on our NORMALIZED status enum (`pending`/`confirmed`).
 * That enum is a DISPLAY bucket: it collapses "unpaid draft", "confirmed, start
 * packing" and "already in transit" into two values, so it cannot express
 * "needs picking". Worse, `STATUS_MAP` has no entry for `UNPAID`, and the
 * `?? 'pending'` fallback UPGRADED an unrecognised status into the most
 * actionable bucket we have. A PREPAID order the buyer never paid for was
 * therefore announced as "collect and ship", then auto-cancelled by Yandex 30
 * minutes later (order 60767668482 — see
 * docs/investigations/order-cancellation-sync-findings.md).
 *
 * So the gate below reads the RAW marketplace status, not the normalized enum,
 * and is a POSITIVE whitelist. That inverts the dangerous default: a status we
 * do not recognise now means "no alert", never "collect and ship". Yandex's own
 * spec ships an `UNKNOWN` status value and adds substatuses over time, so the
 * default has to be the safe one.
 *
 * Same shape as RESERVING_RAW_STATUSES in lib/marketplace/stock-allocation.ts —
 * kept here as one shared definition so the two sync paths cannot drift apart
 * on what "needs fulfilling" means.
 *
 * ── Scope ───────────────────────────────────────────────────────────────────
 * This module decides ALERTS ONLY. It does not touch what we persist: the
 * normalized `status`, `marketplace_status`, the dashboard buckets and the
 * stock draw-down are all unchanged by it.
 */

/** Yandex: the only order status from which a seller ships. */
export const YM_FULFILLMENT_STATUS = 'PROCESSING'

/**
 * Yandex PROCESSING substatuses that mean "the seller must act now".
 * Values verbatim from the Partner API spec (OrderSubstatusType):
 *   STARTED       — «заказ подтвержден, его можно начать обрабатывать»
 *   READY_TO_SHIP — «заказ собран и готов к отправке»
 *
 * Deliberately excluded, and why:
 *   SHIPPED  — already handed to delivery; "collect and ship" is meaningless.
 *   PENDING (a top-level status, «ожидает обработки со стороны продавца»)
 *            — ambiguous in our FBS flow; excluded until it is shown to need an
 *              alert. Adding it later is a deliberate one-line change here.
 *   UNPAID / PLACING / RESERVED — not paid or not finalised. This is the bug.
 *   CANCELLED / DELIVERY / PICKUP / DELIVERED / RETURNED / UNKNOWN — nothing to pick.
 */
export const YM_FULFILLMENT_SUBSTATUSES = ['STARTED', 'READY_TO_SHIP'] as const

/** Raw fields we need off a Yandex order to decide. Structural on purpose so
 *  callers can pass the API DTO straight in without a mapping step that could
 *  reintroduce the normalized enum. */
export interface RawYandexOrderStatus {
  status?: string | null
  substatus?: string | null
}

/**
 * True only when a Yandex order is confirmed AND awaiting the seller's
 * pick/pack/ship. Everything else — including anything unrecognised, and
 * including a PROCESSING order whose substatus is missing — is false.
 *
 * `substatus` is a REQUIRED property of Yandex's OrderDTO, so a PROCESSING
 * order arriving without one means the payload shape changed. Returning false
 * is the safe answer; callers surface the count so it is visible rather than
 * silent (see `debug.ordersAlertSkipped` in lib/yandex/sync.ts).
 */
export function isYandexFulfillmentRequired(order: RawYandexOrderStatus): boolean {
  if (order.status !== YM_FULFILLMENT_STATUS) return false
  return (YM_FULFILLMENT_SUBSTATUSES as readonly string[]).includes(order.substatus ?? '')
}
