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

/** Tiers a seller can buy right now, by card, without talking to anyone. */
const SELF_SERVE: Record<string, PlanKey> = {
  pro: 'pro',
  pro_plus: 'pro_plus',
}

/**
 * Tiers with a published price that checkout cannot bill yet.
 *
 * Biznes has a real, quotable price — it is what you would be invoiced — but it
 * is NOT in PLAN_PRICES_TIYIN, because users.plan cannot store 'biznes' and both
 * checkout routes reject anything but pro/pro_plus. Listing it there would make
 * it look purchasable and fail at settlement. Shown with a contact action, the
 * number is honest: a seller can see what the tier costs before getting in
 * touch, instead of a bare "contact us" that hides the price.
 *
 * Enterprise stays absent: there is no single price to publish.
 */
const CONTACT_PRICE_TIYIN: Partial<Record<Tier, { monthly: number; annualPerMonth: number }>> = {
  biznes: { monthly: 50_000_000, annualPerMonth: 45_000_000 }, // 500 000 / 450 000 so'm
}

/** True when the tier can be paid for by card today. */
export function isSelfServe(tier: Tier): boolean {
  return tier in SELF_SERVE
}

/** True when the tier has a published price but must be arranged by invoice. */
export function isContactPriced(tier: Tier): boolean {
  return tier in CONTACT_PRICE_TIYIN
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
  if (key) {
    const p = PLAN_PRICES_TIYIN[key]
    return interval === 'annual' ? p.annualPerMonth : p.monthly
  }
  const contact = CONTACT_PRICE_TIYIN[tier]
  if (contact) {
    return interval === 'annual' ? contact.annualPerMonth : contact.monthly
  }
  return null
}

/** The full amount billed once for a year of `tier`, or null when unpriced. */
export function tierAnnualTotalTiyin(tier: Tier): number | null {
  const key = SELF_SERVE[tier]
  if (key) return planAnnualTotalTiyin(key)
  const contact = CONTACT_PRICE_TIYIN[tier]
  return contact ? contact.annualPerMonth * 12 : null
}

/** Where the checkout flow starts for a tier, or null when it is contact-only. */
export function tierCheckoutHref(tier: Tier, interval: Interval = 'monthly'): string | null {
  if (tier === 'free') return '/login'
  const key = SELF_SERVE[tier]
  if (!key) return null
  return `/login?plan=${key}${interval === 'annual' ? '&interval=annual' : ''}`
}
