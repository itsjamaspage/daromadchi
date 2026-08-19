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
 * How far into a band counts as "about to outgrow it".
 *
 * 90 %. This was already the rule — the Enterprise outreach popup fires at
 * 162 mln, which is 90 % of the 180 mln Biznes ceiling — it just was not written
 * as a rule. Naming it here means the billing page's warning and the outreach
 * popup answer the same question with the same arithmetic instead of two
 * numbers that agree by coincidence until someone edits one.
 */
export const NEAR_CEILING_FRACTION = 0.9

/** The turnover range a tier owns: [min, max). max is null for the top tier. */
export function bandRange(tier: Tier): { min: number; max: number | null } {
  const i = TURNOVER_BANDS.findIndex(b => b.tier === tier)
  if (i === -1) return { min: 0, max: null }
  return {
    min: TURNOVER_BANDS[i].min,
    // Bands are ordered high → low, so the NEXT tier up is the previous entry.
    max: i === 0 ? null : TURNOVER_BANDS[i - 1].min,
  }
}

/** The tier above this one, or null at the top. */
export function nextTierUp(tier: Tier): Tier | null {
  const i = TURNOVER_BANDS.findIndex(b => b.tier === tier)
  return i > 0 ? TURNOVER_BANDS[i - 1].tier : null
}

/**
 * Turnover at which a seller is close enough to the top of `tier` to be told.
 * null for Enterprise, which has no ceiling to approach.
 */
export function nearCeilingThreshold(tier: Tier): number | null {
  const { max } = bandRange(tier)
  return max === null ? null : Math.round(max * NEAR_CEILING_FRACTION)
}

/**
 * Turnover at which we reach out before the seller outgrows Biznes.
 *
 * Derived rather than typed, so it cannot drift from the rule above: it IS
 * "90 % of the Biznes ceiling", and it still evaluates to 162 000 000.
 */
export const ENTERPRISE_POPUP_THRESHOLD = nearCeilingThreshold('biznes') as number

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
