/**
 * Variant-safe order-item → product resolution. Pure: no DB, no network.
 *
 * ── The bug this exists to prevent ──────────────────────────────────────────
 * An Uzum order line for a BLACK watch ("5124786-JMM99-ЧЕРН") linked to the
 * WHITE product (JMWHT). Two independent mechanisms made colour invisible:
 *
 *  1. LEGACY_SKU_ALIASES mapped the BASE article JMM99 → JMWHT. JMM99 is shared
 *     by both colours, so canonicalSkuCandidates() emitted 'JMWHT' for every
 *     variant of it. Removed — see sku-aliases.ts.
 *  2. The lookup maps were Map<key, id>, last write wins. Both colours share a
 *     product title, so one variant became unreachable and every order for it
 *     resolved to the other.
 *
 * The damage was not a cosmetic mislabel: the sold unit reserved against the
 * wrong product, so the right one's `pending` stayed 0, its shared stock stayed
 * high, and the manual-stock reminder told the seller to raise a listing they
 * had just sold out of. Sales attribution and P&L moved to the wrong variant too.
 *
 * The fix is to make colour part of the decision. It is available on both sides
 * already — order lines carry it via uzumItemSnapshot (resolveColor over the
 * skuTitle), products carry variant_color — so nothing new has to be derived.
 */

/** One product a lookup key could mean. */
export interface ProductCandidate {
  id: string
  /** products.variant_color — a resolved colour key, or null when uncoloured. */
  color: string | null
}

/**
 * Which product a key means, given the order line's colour. Undefined when the
 * answer is not unambiguous.
 *
 * Rules, in order:
 *   • no candidates          → undefined
 *   • exactly one candidate  → it, colour irrelevant (an unambiguous key needs
 *                              no tie-break, and demanding one would orphan
 *                              every single-variant product)
 *   • several, no item colour→ undefined
 *   • several, item colour   → the one candidate whose colour matches; if none
 *                              or more than one match, undefined
 *
 * ── Why undefined rather than a best guess ─────────────────────────────────
 * A null product_id is recoverable. The sync's preservedLinks guard keeps an
 * earlier good link rather than overwriting it with null, and a later sync or a
 * manual backfill can still resolve it once identifiers improve.
 *
 * A WRONG link is recoverable by nothing. It silently corrupts reservations,
 * shared stock, P&L and sales attribution, and it looks exactly like a correct
 * link until someone reconciles a marketplace by hand. Guessing is how this bug
 * happened; refusing to guess is the fix.
 */
export function pickByColor(
  candidates: readonly ProductCandidate[] | undefined,
  itemColor: string | null,
): string | undefined {
  if (!candidates || candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0].id
  if (!itemColor) return undefined
  const hits = candidates.filter(c => c.color === itemColor)
  return hits.length === 1 ? hits[0].id : undefined
}
