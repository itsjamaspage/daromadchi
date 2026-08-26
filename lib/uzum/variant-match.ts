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

import { canonicalSkuCandidates } from '@/lib/products/sku-aliases'

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

/* ── The shared lookup index ───────────────────────────────────────────────────
 *
 * pickByColor only decides BETWEEN candidates. Which candidates it is handed is
 * the other half of the answer, and the half that was wrong in the first audit
 * script: it looked up "every product in the shop whose colour matches", so a
 * black watch line offered both the black watch AND a black powerbank, and the
 * "correct product" column named whichever came first. Colour is a TIE-BREAK,
 * never a search key.
 *
 * The sync resolves the candidate list from IDENTITY keys — marketplace variant
 * id, seller article, barcode, product title — and only then breaks the tie by
 * colour. That order is what makes a cross-product match impossible: a powerbank
 * shares no article, barcode or title with a watch, so it never enters the list.
 *
 * This index is that first half, extracted so the sync and the audit run one
 * implementation instead of two that agree until they don't. Pure: no DB, no
 * network, no marketplace call.
 */

/** A products row, as far as matching is concerned. */
export interface IndexedProduct {
  id: string
  sku?: string | null
  title?: string | null
  /** products.market_barcode */
  barcode?: string | null
  /** products.marketplace_product_id — the marketplace's own variant id. */
  marketplaceProductId?: string | number | null
  /** products.variant_color */
  color?: string | null
}

export interface VariantIndex {
  /** marketplace variant id → product id. Already variant-specific: no tie-break. */
  byMarketplaceId: Map<string, string>
  bySku: Map<string, ProductCandidate[]>
  byTitle: Map<string, ProductCandidate[]>
  byBarcode: Map<string, ProductCandidate[]>
  /** Every indexed product, for the single-product-shop fallback. */
  all: ProductCandidate[]
}

/** One order line, as far as matching is concerned. */
export interface VariantLookupItem {
  marketplaceProductId?: string | number | null
  /** Every shape the line carries the seller article in, best first. */
  skus?: readonly (string | null | undefined)[]
  barcode?: string | number | null
  title?: string | null
  /** The line's own colour (order_items.variant_color). */
  color?: string | null
}

const normKey = (s: string): string => s.trim().toLowerCase()

/** Build the lookup index for ONE shop's products. */
export function buildVariantIndex(rows: readonly IndexedProduct[]): VariantIndex {
  const index: VariantIndex = {
    byMarketplaceId: new Map(),
    bySku: new Map(),
    byTitle: new Map(),
    byBarcode: new Map(),
    all: [],
  }
  const push = (m: Map<string, ProductCandidate[]>, k: string, c: ProductCandidate): void => {
    const arr = m.get(k)
    if (arr) arr.push(c)
    else m.set(k, [c])
  }
  for (const p of rows) {
    const cand: ProductCandidate = { id: p.id, color: p.color ?? null }
    index.all.push(cand)
    const mpid = p.marketplaceProductId != null ? String(p.marketplaceProductId).trim() : ''
    if (mpid) index.byMarketplaceId.set(mpid, p.id)
    const title = (p.title ?? '').trim()
    if (title) push(index.byTitle, normKey(title), cand)
    // products.sku holds the seller's clean article ("JMWHT") — the reliable
    // cross-feed join key. Skip it when it is merely the stringified marketplace
    // id (what the order-stub path writes): that is already covered by
    // byMarketplaceId, and indexing it as an article invents matches.
    const sku = (p.sku ?? '').trim()
    if (sku && sku !== mpid) push(index.bySku, normKey(sku), cand)
    const barcode = (p.barcode ?? '').trim()
    if (barcode) push(index.byBarcode, barcode, cand)
  }
  return index
}

/**
 * Which product an order line means. `null` when no identity key resolves it
 * unambiguously — see pickByColor above for why that beats a guess.
 *
 * Identity first, colour second, in the sync's own order of confidence:
 *   marketplace variant id → seller article (through the alias/prefix
 *   normalizer) → barcode → product title → the shop's only product.
 */
export function resolveVariant(index: VariantIndex, item: VariantLookupItem): string | null {
  const color = item.color ?? null
  const mpid = item.marketplaceProductId != null ? String(item.marketplaceProductId).trim() : ''
  if (mpid) {
    const hit = index.byMarketplaceId.get(mpid)
    if (hit) return hit
  }
  for (const raw of item.skus ?? []) {
    for (const cand of canonicalSkuCandidates(raw)) {
      const hit = pickByColor(index.bySku.get(normKey(cand)), color)
      if (hit) return hit
    }
  }
  const barcode = item.barcode != null ? String(item.barcode).trim() : ''
  if (barcode) {
    const hit = pickByColor(index.byBarcode.get(barcode), color)
    if (hit) return hit
  }
  const title = (item.title ?? '').trim()
  if (title) {
    const hit = pickByColor(index.byTitle.get(normKey(title)), color)
    if (hit) return hit
  }
  return index.all.length === 1 ? index.all[0].id : null
}
