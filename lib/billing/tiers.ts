/**
 * Turnover → tier assignment.
 *
 * A seller's tier is DERIVED from their trailing-30-day net turnover, not
 * chosen. This module is the single source of truth for where the band
 * boundaries sit, and is deliberately pure: no DB, no network, no clock.
 * computeTurnover30d() (lib/db/turnover.ts) supplies the number.
 *
 * ── Deliberately NOT here: prices ───────────────────────────────────────────
 * The charged amount lives in PLAN_PRICES_TIYIN (./plans.ts) and is what ATMOS
 * bills. Today it holds the OLD flat prices (Pro 250 000, Pro+ 500 000 so'm),
 * which do not match the new turnover ladder. Restating the new prices here
 * would create two disagreeing sources of truth for money, and editing
 * PLAN_PRICES_TIYIN would silently reprice every live subscription before
 * grandfathering exists. So this branch ships band boundaries only; prices move
 * with the pricing-page work, where grandfathering is handled.
 */

/** Derived tiers. Wider than the users.plan enum, which still has only free/pro/pro_plus. */
export type Tier = 'free' | 'pro' | 'pro_plus' | 'biznes' | 'enterprise'

/**
 * Lower bound of each tier, in so'm of trailing-30-day net turnover. A tier owns
 * turnover from its `min` (inclusive) up to the next tier's `min` (exclusive),
 * so exactly 12 000 000 is PRO, not FREE.
 *
 * Ordered high → low so assignTier can return the first match.
 */
export const TURNOVER_BANDS: readonly { tier: Tier; min: number }[] = [
  { tier: 'enterprise', min: 180_000_000 },
  { tier: 'biznes',     min: 120_000_000 },
  { tier: 'pro_plus',   min:  50_000_000 },
  { tier: 'pro',        min:  12_000_000 },
  { tier: 'free',       min:           0 },
] as const

/**
 * Turnover at which we reach out before the seller outgrows Biznes — 90 % of the
 * 180 mln Enterprise floor. Not a band boundary; it triggers the outreach popup.
 */
export const ENTERPRISE_POPUP_THRESHOLD = 162_000_000

/**
 * Map trailing-30-day turnover (so'm) to a tier.
 *
 * Non-finite input (NaN/Infinity, e.g. a failed aggregate coerced with Number())
 * and negative turnover both fall back to 'free': the safe direction is to
 * under-charge on bad data, never to bill someone a tier we cannot justify.
 */
export function assignTier(turnover: number): Tier {
  if (!Number.isFinite(turnover) || turnover < 0) return 'free'
  for (const band of TURNOVER_BANDS) {
    if (turnover >= band.min) return band.tier
  }
  return 'free'
}

/** True when turnover warrants the pre-Enterprise outreach popup. */
export function shouldTriggerEnterpriseOutreach(turnover: number): boolean {
  return Number.isFinite(turnover) && turnover >= ENTERPRISE_POPUP_THRESHOLD
}
