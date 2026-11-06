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
 * therefore announced as "collect and ship", then auto-cancelled by the
 * marketplace 30 minutes later (order 60767668482 — see
 * docs/investigations/order-cancellation-sync-findings.md).
 *
 * So the gate below reads the RAW marketplace status, not the normalized enum,
 * and is a POSITIVE whitelist. That inverts the dangerous default: a status we
 * do not recognise now means "no alert", never "collect and ship". Marketplaces
 * ship `UNKNOWN` status values and add substatuses over time, so the default
 * has to be the safe one.
 *
 * Same shape as RESERVING_RAW_STATUSES in lib/marketplace/stock-allocation.ts —
 * kept here as one shared definition so the sync and the alert cannot drift
 * apart on what "needs fulfilling" means.
 *
 * ── Scope ───────────────────────────────────────────────────────────────────
 * This module decides ALERTS ONLY. It does not touch what we persist: the
 * normalized `status`, `marketplace_status`, the dashboard buckets and the
 * stock draw-down are all unchanged by it.
 */

/**
 * Uzum raw FBS statuses meaning "the seller is still preparing this order".
 *
 * A positive whitelist, for the same reason as above: an unrecognised status
 * must mean "no action needed", never "collect
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
 * `marketplace_status` is the RAW value the sync persists verbatim. It is the
 * only field that can answer this: the normalized `status` enum is a display
 * bucket that collapses "seller must ship" and "already in transit" into
 * 'pending'/'confirmed', which is exactly the conflation this gate was written
 * to escape.
 *
 * Rows synced before marketplace_status existed (migration 054) have it NULL
 * and return false. That is the safe direction — a missing raw status means we
 * genuinely do not know, and inventing an entry for it would repeat the
 * `?? 'pending'` mistake.
 */
export function orderNeedsFulfilment(order: {
  marketplace: string
  marketplace_status?: string | null
}): boolean {
  const raw = (order.marketplace_status ?? '').toUpperCase()
  if (!raw) return false
  if (order.marketplace === 'uzum') return isUzumFulfillmentRequired(raw)
  return false
}
