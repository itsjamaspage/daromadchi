/**
 * Derived per-product analytics — computed, never fetched.
 *
 * Every figure here comes from `orders` + `order_items`, which BOTH syncs
 * populate identically. That is the selection rule: a column that works on
 * Uzum but not Yandex (or the reverse) is worse than no column, because a
 * seller cannot tell an empty cell from a zero.
 *
 * ── What was deliberately left out, and why ─────────────────────────────────
 *  • Anything advertising — spend, ДРР, CTR, CPC, показы, сессии, в корзину.
 *    There is no ads integration for either marketplace, so these would be
 *    permanently empty columns.
 *  • Anything built on products.quantity_sold (the marketplace's own lifetime
 *    units-sold). Only lib/uzum/sync.ts writes it — lib/yandex/sync.ts never
 *    does — so a "lifetime sold" column would silently be Uzum-only.
 */

/** One product's sales facts for a period. Marketplace-agnostic by design. */
export interface SalesFacts {
  /** Units on orders that completed. */
  delivered: number
  /** Units on orders the buyer returned. */
  returned: number
  /** Revenue of real sales in the period. */
  revenue: number
}

export interface DerivedMetrics {
  /**
   * Revenue ÷ delivered units — what the seller ACTUALLY got per unit, which
   * is not the listed price once discounts and promotions are applied. The gap
   * between this and Price is the number worth looking at.
   *
   * Null when nothing was delivered: there is no realised price for a product
   * that did not sell, and 0 would read as "we sold it for nothing".
   */
  avgPrice: number | null
  /**
   * Returns ÷ (delivered + returns), as a percentage.
   *
   * The denominator includes returns because a returned unit WAS delivered
   * first — dividing by delivered alone would let a product with 1 delivered
   * and 1 returned read as 100% when it is really 50%.
   *
   * Null when nothing shipped, for the same reason as avgPrice.
   */
  returnRate: number | null
  /** This product's share of the period's total revenue, as a percentage. */
  salesShare: number
}

export function deriveMetrics(f: SalesFacts, totalRevenue: number): DerivedMetrics {
  const shipped = f.delivered + f.returned
  return {
    avgPrice:   f.delivered > 0 ? f.revenue / f.delivered : null,
    returnRate: shipped > 0 ? (f.returned / shipped) * 100 : null,
    salesShare: totalRevenue > 0 ? (f.revenue / totalRevenue) * 100 : 0,
  }
}

export type AbcClass = 'A' | 'B' | 'C'

/** Cumulative-share cutoffs. The classic Pareto split. */
export const ABC_A_CUTOFF = 80
export const ABC_B_CUTOFF = 95

/**
 * ABC classification by revenue, keyed by whatever id the caller uses.
 *
 * Standard cumulative-share method: rank by revenue, walk down, and the
 * products that make up the first 80% of revenue are A, up to 95% are B, the
 * rest C.
 *
 * ── The cutoff belongs to the product that CROSSES it ───────────────────────
 * The product whose own revenue takes the running total past 80% is still an
 * A. Assigning it B would mean the A group does not actually cover 80% of
 * revenue, which is the one thing the label promises.
 *
 * ── Products with no revenue are C, not unclassified ────────────────────────
 * "This earned nothing this period" is exactly what C means, and leaving them
 * blank would make an unsold product look like a data gap.
 */
export function abcClassify(rows: Array<{ id: string; revenue: number }>): Map<string, AbcClass> {
  const out = new Map<string, AbcClass>()
  const total = rows.reduce((s, r) => s + Math.max(0, r.revenue), 0)
  if (total <= 0) {
    // No revenue at all: everything is C. Ranking by zero would be arbitrary.
    for (const r of rows) out.set(r.id, 'C')
    return out
  }
  const ranked = [...rows].sort((a, b) => b.revenue - a.revenue)
  let cumulative = 0
  for (const r of ranked) {
    const before = (cumulative / total) * 100
    cumulative += Math.max(0, r.revenue)
    // Classified on the share BEFORE this product is added, so the one that
    // crosses a boundary lands in the group it completes.
    out.set(r.id, r.revenue <= 0 ? 'C' : before < ABC_A_CUTOFF ? 'A' : before < ABC_B_CUTOFF ? 'B' : 'C')
  }
  return out
}
