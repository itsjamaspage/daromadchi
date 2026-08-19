export type PlanKey  = 'pro' | 'pro_plus' | 'biznes'
export type Interval = 'monthly' | 'annual'

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for money. Prices are a FIXED so'm amount, stored in
// TIYIN (1 so'm = 100 tiyin) as integers. Every place that shows OR charges a
// price reads from here: the landing page, /pricing, the dashboard billing page,
// and the ATMOS charge (amount_tiyin). We do NOT charge an FX-derived, daily-
// fluctuating number — the USD figure is a DISPLAY-ONLY approximation and MUST
// NEVER feed a charged amount.
//
// Each plan carries BOTH figures explicitly: the monthly price, and the
// per-month price when billed annually.
//
// Yearly used to be derived from a whole-number discount, which cannot express
// the agreed ladder: Pro's 150 000 → 125 000 is 16.67 %, and rounding that to
// 17 % would CHARGE 124 500 while every page advertised 125 000. The agreed
// numbers are the source of truth; the discount badge is derived from them
// instead (annualDiscountPct below), so display and charge cannot disagree.
//
// Turnover ladder: Pro 150 000/mo (125 000 when billed yearly),
// Pro+ 250 000/mo (225 000 yearly), Biznes 500 000/mo (450 000 yearly).
// Enterprise stays absent — there is no single price to publish, and checkout
// cannot bill it.
//
// Existing subscribers are NOT repriced by changes here: each subscription
// carries the amount it was sold at in agreed_amount_tiyin, and the renewal cron
// charges that.
export const PLAN_PRICES_TIYIN: Record<PlanKey, { monthly: number; annualPerMonth: number }> = {
  pro:      { monthly: 15_000_000, annualPerMonth: 12_500_000 }, // 150 000 / 125 000 so'm
  pro_plus: { monthly: 25_000_000, annualPerMonth: 22_500_000 }, // 250 000 / 225 000 so'm
  biznes:   { monthly: 50_000_000, annualPerMonth: 45_000_000 }, // 500 000 / 450 000 so'm
}

/**
 * Is this a plan checkout can sell?
 *
 * Derived from PLAN_PRICES_TIYIN and exported from here so every gate on "which
 * plans are real" reads the same table. Two API routes had already copied this
 * function; the copies that mattered were the hand-written `plan === 'pro' ||
 * plan === 'pro_plus'` checks elsewhere, which is how Biznes could be charged
 * for and then never granted.
 */
export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PLAN_PRICES_TIYIN, v)
}

/** What each plan is called on an invoice and in the UI. */
export const PLAN_DISPLAY_NAME: Record<PlanKey, string> = {
  pro:      'Pro',
  pro_plus: 'Pro+',
  biznes:   'Biznes',
}

// The amount charged once for a 12-month subscription.
export function planAnnualTotalTiyin(plan: PlanKey): number {
  return PLAN_PRICES_TIYIN[plan].annualPerMonth * 12
}

// The "−N %" badge. Derived from the two prices above so it can never advertise
// a saving the charged amounts do not actually deliver.
export function annualDiscountPct(plan: PlanKey): number {
  const p = PLAN_PRICES_TIYIN[plan]
  return Math.round((1 - p.annualPerMonth / p.monthly) * 100)
}

// DISPLAY-ONLY dollar reference for the "≈ $N/mo" secondary label. Never charged.
export const PLAN_PRICES_USD_DISPLAY: Record<PlanKey, number> = {
  pro:      20,
  pro_plus: 40,
  biznes:   80,
}

/**
 * How long before a charge an existing subscriber must be told about a price
 * increase.
 *
 * Lives here, with the prices themselves, because it is a term OF the price and
 * because this module is client-safe: /terms is a client component and quotes
 * this number, and pulling it from lib/billing/price-notice.ts would drag the
 * database driver into the browser bundle. The enforcement reads the same
 * constant, so the document cannot promise a window the renewal does not keep.
 *
 * Two weeks matches the trial window sellers already know, and is long enough
 * that cancelling before the new amount lands is a real option, not a race.
 */
export const PRICE_NOTICE_DAYS = 14

export const TIYIN_PER_SOM = 100

// Exact integer conversions. Amounts sent to ATMOS are ALWAYS tiyin; amounts
// shown to users are ALWAYS so'm. Keep the boundary explicit — a wrong exponent
// here over/undercharges 100×.
export function somToTiyin(som: number): number {
  return Math.round(som) * TIYIN_PER_SOM
}
export function tiyinToSom(tiyin: number): number {
  return Math.round(tiyin / TIYIN_PER_SOM)
}

// The tiyin amount to charge for a plan+interval. This is the value the ATMOS
// checkout passes as `amount`.
export function planAmountTiyin(plan: PlanKey, interval: Interval): number {
  return interval === 'annual' ? planAnnualTotalTiyin(plan) : PLAN_PRICES_TIYIN[plan].monthly
}

// How many months a plan+interval covers (for subscription period math).
export function planPeriodMonths(interval: Interval): number {
  return interval === 'annual' ? 12 : 1
}

// tiyin → "252 000" (so'm, space-grouped thousands). Display only.
export function formatSomFromTiyin(tiyin: number): string {
  return String(tiyinToSom(tiyin)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// The per-month so'm figure shown on the annual toggle (yearly total / 12).
export function annualMonthlySom(plan: PlanKey): number {
  return Math.round(tiyinToSom(planAnnualTotalTiyin(plan)) / 12)
}

export function planExpiresAt(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
