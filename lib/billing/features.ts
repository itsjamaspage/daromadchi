/**
 * The ONE place that answers "may this account use X?".
 *
 * ── Entitlement is not the derived tier ─────────────────────────────────────
 * users.plan is ENTITLEMENT: what the seller has actually paid for. It is
 * written only by payment settlement (lib/billing/activate.ts) and expiry
 * (app/api/billing/expire-plans). The turnover-derived tier is a RECOMMENDATION
 * and lives in its own column; nothing here reads it. Conflating the two would
 * hand a free seller with high turnover full paid access without a payment,
 * which is the opposite of the recommend-before-charge rollout.
 *
 * Everything below is pure — no DB, no network. Callers load the row and pass
 * it in, which keeps the rules unit-testable and lets both server components
 * and cron jobs share one implementation.
 */

/** Plans a seller can hold. Wider than the users.plan enum, which has only the first three. */
export type Plan = 'free' | 'pro' | 'pro_plus' | 'biznes' | 'enterprise'

const PAID_PLANS: ReadonlySet<string> = new Set(['pro', 'pro_plus', 'biznes', 'enterprise'])

/** Gateable capabilities. Named for the surface a seller sees, not the module behind it. */
export type Feature =
  | 'dashboard'
  | 'products'
  | 'orders'          // includes the order/low-stock Telegram alerts
  | 'marketplaces'    // Uzum + Yandex both, on every tier
  | 'analytics'
  | 'stock_sync'      // the Sklad page + cross-store write-back
  | 'finances'        // finances / payouts
  | 'unit_economics'

/**
 * Features a FREE account keeps forever. Everything else is trial-then-gated.
 * A permanent free user still sees revenue and profit on the dashboard — that is
 * the hook, and it is deliberate.
 */
const FREE_FOREVER: ReadonlySet<Feature> = new Set<Feature>([
  'dashboard', 'products', 'orders', 'marketplaces',
])

/** Features a free account gets only while its trial is running. */
const TRIAL_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  'analytics', 'stock_sync', 'finances', 'unit_economics',
])

/**
 * How long a NEW free account's trial runs.
 *
 * Existing trial_ends_at values are never rewritten, so changing this only
 * affects accounts that have not started a trial yet — nobody in flight loses
 * days they were already promised.
 *
 * Every piece of user-facing copy derives from this number (lib/tiersT.ts).
 * Hardcoding it in the UI is how the site ended up advertising a 3-day trial
 * long after the code had moved on.
 */
export const TRIAL_DAYS = 14

export function trialEndFrom(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}

/** The fields entitlement depends on. Load once, pass in. */
export interface EntitlementInput {
  /** users.plan — what they PAID for. Never the derived tier. */
  plan: string | null
  planExpiresAt: Date | string | null
  trialEndsAt: Date | string | null
  /** Old-price accounts keep full access permanently. */
  isGrandfathered?: boolean | null
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** True while a free account is inside its trial window. */
export function isOnTrial(input: EntitlementInput, now: Date = new Date()): boolean {
  const plan = input.plan ?? 'free'
  if (PAID_PLANS.has(plan)) return false
  const ends = toDate(input.trialEndsAt)
  return ends !== null && ends > now
}

/**
 * The plan a seller effectively has right now: their paid plan unless it has
 * lapsed, or 'pro' while a free account's trial runs.
 *
 * This is the single implementation of a rule that was previously duplicated in
 * lib/api/auth.ts, app/api/cron/sync/route.ts and app/api/diagnostics/state.
 * Behaviour is unchanged; only the number of copies is.
 */
export function computeEffectivePlan(input: EntitlementInput, now: Date = new Date()): Plan {
  const plan = (input.plan ?? 'free') as Plan
  if (PAID_PLANS.has(plan)) {
    const expires = toDate(input.planExpiresAt)
    return expires !== null && expires < now ? 'free' : plan
  }
  return isOnTrial(input, now) ? 'pro' : 'free'
}

/**
 * May this account use `feature` right now?
 *
 * Order matters: grandfathering is checked FIRST, before any plan or trial
 * logic, so an old-price account can never be gated by a rule written later.
 */
export function hasFeature(input: EntitlementInput, feature: Feature, now: Date = new Date()): boolean {
  if (input.isGrandfathered) return true
  if (FREE_FOREVER.has(feature)) return true

  const effective = computeEffectivePlan(input, now)
  if (PAID_PLANS.has(effective)) return true

  // Free and out of trial: only the permanent set, already returned above.
  return TRIAL_FEATURES.has(feature) && isOnTrial(input, now)
}

/**
 * Order the capabilities are listed in on marketing surfaces. Same order the
 * /pricing comparison table uses, so the two never disagree about the story.
 */
export const FEATURE_ORDER: readonly Feature[] = [
  'dashboard', 'products', 'orders', 'marketplaces',
  'analytics', 'stock_sync', 'finances', 'unit_economics',
] as const

/** How a feature reads on a plan card: kept for good, or only for the trial. */
export type FeatureAvailability = 'included' | 'trial'

/**
 * What a plan's "what's included" list should say about `feature`.
 *
 * Derived from the very sets hasFeature() gates on, so a plan card cannot
 * advertise something the gate then refuses. Paid tiers differ by turnover and
 * price, not capability, so they all read the same.
 */
export function featureAvailability(plan: Plan, feature: Feature): FeatureAvailability {
  if (PAID_PLANS.has(plan)) return 'included'
  return FREE_FOREVER.has(feature) ? 'included' : 'trial'
}
