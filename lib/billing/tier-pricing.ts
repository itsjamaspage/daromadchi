/**
 * What a tier COSTS, for display.
 *
 * ── Display must equal charge ───────────────────────────────────────────────
 * Every figure here derives from PLAN_PRICES_TIYIN — the same constant ATMOS is
 * charged from. A pricing page that advertises one number while checkout bills
 * another is the one thing this module exists to make impossible. Change that
 * constant and every surface moves with it, in the same deploy.
 *
 * ── Not every tier is self-serve ────────────────────────────────────────────
 * PLAN_PRICES_TIYIN carries every tier checkout can bill: pro, pro_plus and now
 * biznes. Enterprise returns null and the UI renders "contact us", because there
 * is no single price to publish. Inventing one here would put an amount on
 * screen that no code path can charge — the same lie in the other direction.
 */
import { PLAN_PRICES_TIYIN, planAnnualTotalTiyin, type PlanKey, type Interval } from './plans'
import type { Tier } from './tiers'

/**
 * Tiers a seller can buy right now, by card, without talking to anyone.
 *
 * Derived from PLAN_PRICES_TIYIN rather than listed separately: a tier with a
 * charged price IS a tier checkout can sell, and keeping a second hand-written
 * list is how Biznes ended up priced but unbuyable.
 */
function selfServeKey(tier: Tier): PlanKey | null {
  return Object.prototype.hasOwnProperty.call(PLAN_PRICES_TIYIN, tier) ? (tier as PlanKey) : null
}

/** True when the tier can be paid for by card today. */
export function isSelfServe(tier: Tier): boolean {
  return selfServeKey(tier) !== null
}

// isContactPriced() is gone with Biznes becoming card-payable: it existed only
// to describe a tier that had a published price but no way to pay it, and
// nothing is in that state now. A tier without a price simply returns null from
// tierPriceTiyin and renders "contact us".

/**
 * Price in tiyin for one month of `tier`.
 *
 *   0    — free, nothing to pay
 *   null — no public price: Enterprise is quoted, not listed
 *
 * `interval: 'annual'` returns the per-MONTH figure when billed yearly, which
 * is what the ladder shows under a yearly toggle; the amount actually charged
 * once a year is planAmountTiyin() in plans.ts.
 */
export function tierPriceTiyin(tier: Tier, interval: Interval = 'monthly'): number | null {
  if (tier === 'free') return 0
  const key = selfServeKey(tier)
  if (!key) return null
  const p = PLAN_PRICES_TIYIN[key]
  return interval === 'annual' ? p.annualPerMonth : p.monthly
}

/** The full amount billed once for a year of `tier`, or null when unpriced. */
export function tierAnnualTotalTiyin(tier: Tier): number | null {
  const key = selfServeKey(tier)
  return key ? planAnnualTotalTiyin(key) : null
}

/** Where the checkout flow starts for a tier, or null when it is quote-only. */
export function tierCheckoutHref(tier: Tier, interval: Interval = 'monthly'): string | null {
  if (tier === 'free') return '/login'
  const key = selfServeKey(tier)
  if (!key) return null
  return `/login?plan=${key}${interval === 'annual' ? '&interval=annual' : ''}`
}
