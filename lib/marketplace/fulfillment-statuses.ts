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

/**
 * Yandex placementType values where the SELLER picks, packs and ships.
 *
 * Verbatim from the Partner API spec (PlacementType), whose complete enum is
 * `FBS | FBY | DBS | LAAS`:
 *   FBS  — labelled «FBS или Экспресс»: Express is NOT a separate value, it
 *          arrives as FBS. Seller ships. (The `placement === 'EXPRESS'` branch
 *          in lib/yandex/sync.ts can therefore never match; harmless, since it
 *          resolves to the same 'fbs' either way.)
 *   DBS  — delivery by seller: the seller both stores and delivers. Seller ships.
 *   FBY  — Yandex's own warehouse picks and ships. The seller never touches it,
 *          so "collect and ship" is always wrong for FBY.
 *   LAAS — logistics-as-a-service; not a seller pick-and-pack model we support.
 *          Excluded rather than assumed.
 *
 * This is necessarily a CAMPAIGN-level check: Yandex's OrderDTO carries no
 * per-order fulfilment field (verified against the spec — the DTO has id,
 * status, substatus, paymentType, delivery, items … and nothing naming the
 * model), so the campaign's placementType is the only signal available.
 *
 * Allowlist, not blocklist: an unrecognised value — and `undefined`, which is
 * what the caller holds when the campaign-info call failed — returns false. Do
 * NOT swap this for the sync's `campaignFulfillmentType`: that one falls back
 * to 'fbs' when the API doesn't answer, which would alert on a campaign whose
 * model we never actually established.
 */
export const YM_SELLER_FULFILLED_PLACEMENTS = ['FBS', 'DBS'] as const

export function isYandexSellerFulfilled(placementType: string | null | undefined): boolean {
  if (!placementType) return false
  return (YM_SELLER_FULFILLED_PLACEMENTS as readonly string[]).includes(placementType.toUpperCase())
}

/**
 * Uzum raw FBS statuses meaning "the seller is still preparing this order".
 *
 * Same positive-whitelist shape as the Yandex gate above, and for the same
 * reason: an unrecognised status must mean "no action needed", never "collect
 * and ship". Uzum's enum is fetched live from their OpenAPI document at sync
 * time (lib/uzum/sync.ts:449-460), so new values appear without warning.
 *
 * Taken from the group STATUS_MAP labels «Создан — being prepared by the
 * seller» (lib/uzum/sync.ts:47-55). Deliberately excluded:
 *   DELIVERING / ACCEPTED_AT_DP / … — already handed over; nothing to pick.
 *   DELIVERED* / COMPLETED         — finished.
 *   CANCELED / RETURNED / PENDING_CANCELLATION — nothing to ship.
 *
 * The defensive aliases in that map (NEW, CONFIRMED, PACKED, …) are included:
 * they describe the same not-yet-shipped stage and cost nothing if Uzum never
 * sends them.
 */
export const UZ_FULFILLMENT_STATUSES = [
  'CREATED', 'PACKING', 'PENDING_DELIVERY',
  'NEW', 'PENDING', 'CONFIRMED', 'AGREED', 'ACCEPTED',
  'PACKED', 'PACKAGED', 'ASSEMBLED', 'READY', 'PROCESSING', 'IN_PROGRESS',
] as const

export function isUzumFulfillmentRequired(rawStatus: string | null | undefined): boolean {
  if (!rawStatus) return false
  return (UZ_FULFILLMENT_STATUSES as readonly string[]).includes(rawStatus.toUpperCase())
}

/**
 * Marketplace-agnostic front door for "does this order still need the seller to
 * pick, pack and ship it?", for callers holding a STORED order row rather than
 * a marketplace DTO.
 *
 * `marketplace_status` is the RAW value both syncs persist verbatim. It is the
 * only field that can answer this: the normalized `status` enum is a display
 * bucket that collapses "seller must ship" and "already in transit" into
 * 'pending'/'confirmed', which is exactly the conflation the Yandex gate above
 * was written to escape.
 *
 * ── One deliberate difference from the Telegram gate ────────────────────────
 * isYandexFulfillmentRequired() also checks the SUBSTATUS, and we do not store
 * it: lib/yandex/sync.ts:566 persists `o.status` only. So for a stored Yandex
 * row this can only ask "is it PROCESSING?", which is BROADER — it also covers
 * the SHIPPED substatus, an order already handed to delivery.
 *
 * That is acceptable here and would not be for the Telegram alert. This feeds a
 * list the seller opens and scans; the alert interrupts them. Over-including a
 * just-shipped order in a list costs a glance. The narrower behaviour needs
 * `substatus` persisted on `orders`, which is a schema change and its own
 * change — not something to fake by guessing from the normalized enum.
 *
 * Rows synced before marketplace_status existed (migration 054) have it NULL
 * and return false. That is the safe direction — a missing raw status means we
 * genuinely do not know, and inventing an entry for it would repeat the
 * `?? 'pending'` mistake.
 */
export const YM_STORED_FULFILMENT_STATUSES = [YM_FULFILLMENT_STATUS] as const

export function orderNeedsFulfilment(order: {
  marketplace: string
  marketplace_status?: string | null
}): boolean {
  const raw = (order.marketplace_status ?? '').toUpperCase()
  if (!raw) return false
  if (order.marketplace === 'uzum') return isUzumFulfillmentRequired(raw)
  if (order.marketplace === 'yandex_market') {
    return (YM_STORED_FULFILMENT_STATUSES as readonly string[]).includes(raw)
  }
  return false
}
