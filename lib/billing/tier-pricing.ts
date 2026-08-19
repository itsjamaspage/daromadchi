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
 * PLAN_PRICES_TIYIN carries pro and pro_plus, because those are the only tiers
 * checkout can actually bill today. Biznes and Enterprise return null, and the
 * UI renders "contact us" rather than a number nobody can pay. Inventing a
 * price for them here would put an amount on screen that no code path can
 * charge — which is the same lie in the other direction.
 */
import { PLAN_PRICES_TIYIN, planAnnualTotalTiyin, type PlanKey, type Interval } from './plans'
import type { Tier } from './tiers'

/** Tiers a seller can buy right now, without talking to anyone. */
const SELF_SERVE: Record<string, PlanKey> = {
  pro: 'pro',
  pro_plus: 'pro_plus',
}

/** True when the tier has a price a seller can pay online today. */
export function isSelfServe(tier: Tier): boolean {
  return tier in SELF_SERVE
}

/**
 * Price in tiyin for one month of `tier`.
 *
 *   0    — free, nothing to pay
 *   null — no public price: Biznes and Enterprise are "contact us" until
 *          checkout can bill them
 *
 * `interval: 'annual'` returns the per-MONTH figure when billed yearly, which
 * is what the ladder shows under a yearly toggle; the amount actually charged
 * once a year is planAmountTiyin() in plans.ts.
 */
export function tierPriceTiyin(tier: Tier, interval: Interval = 'monthly'): number | null {
  if (tier === 'free') return 0
  const key = SELF_SERVE[tier]
  if (!key) return null
  return interval === 'annual'
    ? Math.round(planAnnualTotalTiyin(key) / 12)
    : PLAN_PRICES_TIYIN[key].monthly
}

/** The full amount billed once for a year of `tier`, or null when not self-serve. */
export function tierAnnualTotalTiyin(tier: Tier): number | null {
  const key = SELF_SERVE[tier]
  return key ? planAnnualTotalTiyin(key) : null
}

/** Where the checkout flow starts for a tier, or null when it is contact-only. */
export function tierCheckoutHref(tier: Tier, interval: Interval = 'monthly'): string | null {
  if (tier === 'free') return '/login'
  const key = SELF_SERVE[tier]
  if (!key) return null
  return `/login?plan=${key}${interval === 'annual' ? '&interval=annual' : ''}`
}
