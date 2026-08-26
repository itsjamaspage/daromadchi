/**
 * What Daromadchi shows for a product's price and stock: the seller's override
 * where they set one, the marketplace's number otherwise.
 *
 * ── Why this is its own module ──────────────────────────────────────────────
 * It used to be exported from AnalyticsProductTable.tsx, which carries
 * 'use client'. Next.js replaces EVERY export of a client module with a client
 * reference, so the server component that imported it was not calling a
 * function at all — it was calling a proxy, and the page threw at request time
 * with "Attempted to call effective() from the server". It compiled and built
 * cleanly; only a real request could show it.
 *
 * So this file deliberately has NO 'use client' directive: it is plain shared
 * logic that both the server page and the client table import. Any future
 * helper both sides need belongs here too, for the same reason.
 *
 * ── Why overrides are layered here, not in the query ────────────────────────
 * They are NOT folded into Product.selling_price / available_stock at the
 * query layer, because those feed the stock engine, turnover, the oversell
 * path and the Products page — a display preference set on Analytics must not
 * reach any of them.
 */
import type { Product } from '@/lib/types'

export interface EffectiveValues {
  price: number
  /**
   * NULL when the seller has never entered a cost — deliberately not 0.
   *
   * This used to be `Number(p.cost_price ?? 0)`, and every margin computed from
   * it read `(price − 0) / price` = 100%. That is where "Avg margin 95.9%" on
   * the Analytics page came from: not a shop with extraordinary margins, a shop
   * that had costed some of its catalogue and not the rest. Callers must decide
   * what to show when it is null; the honest answer is "—", not a number.
   */
  cost: number | null
  stockQty: number
  priceOverridden: boolean
  stockOverridden: boolean
}

export function effective(p: Product): EffectiveValues {
  // `!= null` and not a truthiness check: 0 is a real override. A seller must
  // be able to say "I have none of this" and "this is free", and a falsy test
  // would silently read either as "no override set".
  const priceOverridden = p.price_override != null
  const stockOverridden = p.stock_override != null
  return {
    price:    priceOverridden ? Number(p.price_override) : Number(p.selling_price ?? 0),
    cost:     p.cost_price != null ? Number(p.cost_price) : null,
    stockQty: stockOverridden ? Number(p.stock_override) : p.available_stock,
    priceOverridden,
    stockOverridden,
  }
}

/**
 * What a variant PARENT row can honestly show and edit for a whole group.
 *
 * A parent covers several listings. It may only display one number when every
 * listing agrees on it — otherwise the cell says "mixed" rather than picking a
 * member's value and presenting it as the group's, which is how a seller ends
 * up believing all four variants cost what the first one costs.
 *
 * Editing is allowed either way: setting a mixed group is exactly how you make
 * it agree.
 *
 * Lives here, in a plain module, rather than inline in the client table — both
 * so it can be unit-tested without an RSC boundary, and because burying logic
 * inside a 'use client' file is what made the last regression invisible.
 */
export interface GroupSharedValues {
  /** The agreed value, or null when the listings differ or none is set. */
  price: number | null
  cost: number | null
  priceMixed: boolean
  costMixed: boolean
  /** True only when EVERY listing carries a seller override — the dot must not
   *  claim a group is the seller's when one member is still marketplace data. */
  priceOverridden: boolean
}

export function groupSharedValues(rows: Product[]): GroupSharedValues {
  const prices = rows.map(p => effective(p).price)
  const costs  = rows.map(p => p.cost_price != null ? Number(p.cost_price) : null)
  const agreed = (vals: (number | null)[]): number | null => {
    if (vals.length === 0) return null
    const first = vals[0]
    if (!vals.every(v => v === first)) return null
    // 0 and null are both "not set" for display: an unpriced or uncosted
    // listing should read as empty, so the cell offers "+ price" rather than a
    // confident zero. (Costs arrive here as null now rather than coerced to 0;
    // both land in the same branch, which is why the group behaviour is
    // unchanged by that.)
    return first != null && first > 0 ? first : null
  }
  return {
    price: agreed(prices),
    cost:  agreed(costs),
    priceMixed: new Set(prices).size > 1,
    costMixed:  new Set(costs).size > 1,
    priceOverridden: rows.length > 0 && rows.every(p => effective(p).priceOverridden),
  }
}
