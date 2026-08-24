/**
 * Which shop row does a connect request address — an existing one, or a new one?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Both connect paths used to resolve the shop by (user_id, marketplace,
 * is_active) alone, with the marketplace's own account id absent from the
 * predicate. A seller with two Yandex campaigns — the normal shape for FBS +
 * FBY, which Yandex runs as separate campaigns under one business — therefore
 * could not hold both: entering the second campaign id updated the SAME row,
 * and tripped the "campaign changed" branch into clearShopData(), deleting the
 * first campaign's orders, order_items, products, sync_days, ad_campaigns and
 * search_phrases. Then it wiped back the other way on the next switch.
 *
 * The external id is part of a shop's IDENTITY, not just a field on it. Once it
 * is in the predicate, "added a second campaign" and "re-saved the same
 * campaign" stop being the same request.
 *
 * ── Add vs. switch ──────────────────────────────────────────────────────────
 * A connect request carries no intent flag, so the app CANNOT tell "I am adding
 * my second campaign" from "I am moving this shop to a different account". Both
 * look identical: a token plus an unfamiliar external id.
 *
 * So this resolves the ambiguity the non-destructive way: an unfamiliar external
 * id always means a NEW shop. Nothing is ever deleted on a connect. A seller who
 * genuinely switched accounts is left with a stale shop rather than an erased
 * one — recoverable clutter instead of irrecoverable loss.
 *
 * Consequence worth knowing: there is currently no way to remove that stale
 * shop (no delete/deactivate endpoint exists anywhere in the app). Adding one is
 * the natural follow-up; it is deliberately not bundled here.
 *
 * ── Scope ───────────────────────────────────────────────────────────────────
 * Identity resolution ONLY. This decides which row a write addresses; it does
 * not decide what is written, and it never deletes anything.
 */

/** The subset of a shop row this decision needs. */
export interface ShopIdentityCandidate {
  id: string
  shop_id_external: string | null
}

export type ShopIdentityResolution =
  /** Write to this existing row. `adopts` = the row had no external id yet and
   *  is taking this one (first-time entry, or a legacy row created before the
   *  id was known). */
  | { action: 'update'; shopId: string; adopts: boolean }
  /** No row addresses this external id — create one. */
  | { action: 'insert' }
  /** The request names no external id and several rows could be meant. Refusing
   *  is the only safe answer: silently picking one would write a token onto an
   *  arbitrary campaign. */
  | { action: 'ambiguous' }

/**
 * @param candidates active shops for this (user, marketplace)
 * @param externalId the marketplace account id from the request — Yandex's
 *        campaignId. Pass null when the request carries none: Uzum learns its
 *        shop id inside the sync rather than from the seller, and a token-only
 *        re-save may omit it.
 */
export function resolveShopIdentity(
  candidates: readonly ShopIdentityCandidate[],
  externalId: string | null | undefined,
): ShopIdentityResolution {
  const wanted = externalId?.trim() || null

  if (!wanted) {
    // No id to match on. One candidate is unambiguous; none means a first
    // connect. Several can only happen once a user holds multiple campaigns,
    // and then the request has to say which one it means.
    if (candidates.length === 0) return { action: 'insert' }
    if (candidates.length === 1) return { action: 'update', shopId: candidates[0].id, adopts: false }
    return { action: 'ambiguous' }
  }

  // Exact identity match — a re-save of a campaign we already hold.
  const exact = candidates.find(c => c.shop_id_external?.trim() === wanted)
  if (exact) return { action: 'update', shopId: exact.id, adopts: false }

  // A row that has no external id yet adopts this one rather than being left
  // orphaned beside a new row. Safe: the Yandex sync is skipped entirely for a
  // shop with no shop_id_external (app/api/cron/sync/route.ts), so such a row
  // cannot be holding another campaign's synced data.
  const unclaimed = candidates.find(c => !c.shop_id_external?.trim())
  if (unclaimed) return { action: 'update', shopId: unclaimed.id, adopts: true }

  // Unfamiliar id: a second campaign, or an account switch. Indistinguishable,
  // so take the non-destructive reading — a new shop, nothing deleted.
  return { action: 'insert' }
}
