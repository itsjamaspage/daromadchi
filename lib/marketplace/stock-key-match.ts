/**
 * Resolving one product row against a marketplace stocks response.
 *
 * ── Why this is not just `stockMap.get(p.sku)` ──────────────────────────────
 * The light stock refresh used exactly that, while the heavy pass resolves the
 * same product through a chain of identifiers (lib/yandex/sync.ts:301-305:
 * shopSku, then marketSku, then the campaign-offers map, then the inline
 * offer.stocks count). Anything the chain catches and the single lookup misses
 * is a product whose stock the heavy pass refreshes and the light pass silently
 * leaves alone — stale for hours, with no log line saying so.
 *
 * The concrete case: an offer-mappings entry that carries NO shopSku/offerId.
 * `skuOf()` then returns '' and the product is stored with `sku = marketSku`
 * (lib/yandex/sync.ts:334) — a numeric market id that never appears as a key in
 * the stocks response. A repair path exists (the SKU-stats bridge at :444-476)
 * but it only runs when the mapping table came back empty AND the stats
 * endpoint answers; when it doesn't, `products.sku` stays a marketSku and the
 * light refresh can never match that row again.
 *
 * ── What this does instead ──────────────────────────────────────────────────
 * Tries every identifier we already store for the row, exact match first, then
 * a whitespace-tolerant match. `market_sku` leads because it is defined as the
 * exact shopSku the stock endpoints expect (lib/db/schema.ts:220-222) — it is
 * the identifier sourced FROM this very API, so it is the one most likely to
 * be keyed the same way.
 *
 * ── The one rule, unchanged ─────────────────────────────────────────────────
 * A row that matches nothing returns `undefined` — UNKNOWN, never zero. This
 * widens what we can match; it must never widen what we are willing to write.
 * Callers keep the previous value on undefined.
 */

/** The identifiers a products row can be keyed by in a stocks response. */
export interface StockKeyCandidates {
  /** products.sku — the seller article. Usually the offerId. */
  sku?: string | null
  /** products.market_sku — the exact shopSku the stock endpoints expect. */
  market_sku?: string | null
  /** products.marketplace_product_id — marketSku for catalog-created rows. */
  marketplace_product_id?: string | null
}

const clean = (v: string | null | undefined): string => (v ?? '').trim()

/**
 * Every distinct, non-empty identifier for a row, in the order we trust them.
 * Used both to build the request SKU list and to resolve the response.
 */
export function stockKeysFor(p: StockKeyCandidates): string[] {
  const out: string[] = []
  for (const v of [p.market_sku, p.sku, p.marketplace_product_id]) {
    const c = clean(v)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

/**
 * Build a whitespace-tolerant view of a stocks map.
 *
 * Exact keys always win: the trimmed index is only consulted after every exact
 * lookup has missed, so two genuinely distinct SKUs that differ only by
 * whitespace can never be collapsed into each other on the exact path. When
 * two raw keys DO trim to the same string the first one wins and the second is
 * ignored, because picking arbitrarily between two live quantities would be
 * worse than declining to match.
 */
export function trimmedIndex(stockMap: Map<string, number>): Map<string, number> {
  const idx = new Map<string, number>()
  for (const [k, v] of stockMap) {
    const c = clean(k)
    if (!c || c === k) continue          // exact lookup already covers these
    if (!idx.has(c)) idx.set(c, v)
  }
  return idx
}

/**
 * Resolve one product's live quantity, or `undefined` when the response said
 * nothing about it.
 *
 * `undefined` is load-bearing: it means UNKNOWN, and the caller must preserve
 * whatever the row already holds. A `0` here is a real, reported zero.
 */
export function resolveStock(
  p: StockKeyCandidates,
  stockMap: Map<string, number>,
  trimmed?: Map<string, number>,
): number | undefined {
  const keys = stockKeysFor(p)
  // Pass 1 — exact, over every identifier.
  for (const k of keys) {
    const hit = stockMap.get(k)
    if (hit !== undefined) return hit
  }
  // Pass 2 — whitespace-tolerant, same order. Only reached when no identifier
  // matched exactly, so an exact match can never be displaced by a fuzzy one.
  if (trimmed) {
    for (const k of keys) {
      const hit = trimmed.get(k)
      if (hit !== undefined) return hit
    }
  }
  return undefined
}
