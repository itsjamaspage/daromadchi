export type PlanKey  = 'pro' | 'pro_plus'
export type Interval = 'monthly' | 'annual'

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for money. Prices are a FIXED so'm amount, stored in
// TIYIN (1 so'm = 100 tiyin) as integers. Every place that shows OR charges a
// price reads from here: the landing page, /pricing, the dashboard billing page,
// and the ATMOS charge (amount_tiyin). We do NOT charge an FX-derived, daily-
// fluctuating number — the USD figure is a DISPLAY-ONLY approximation and MUST
// NEVER feed a charged amount.
//
// The MONTHLY price is the single knob per plan (tiyin). Change it and the whole
// plan reprices — including the yearly total, which is DERIVED from it, never
// hardcoded. So a 50 000 so'm test monthly automatically yields a 50 000-based
// year; restoring 250 000 restores the 250 000-based year. Default anchors:
// Pro 250 000 so'm/mo, Pro+ 500 000 so'm/mo.
export const PLAN_PRICES_TIYIN: Record<PlanKey, { monthly: number }> = {
  pro:      { monthly: 5_000_000 }, // TEMP TEST: 50 000 so'm/mo (revert to 25_000_000 = 250 000)
  pro_plus: { monthly: 50_000_000 }, // 500 000 so'm/mo
}

// Yearly is 12× the monthly minus a per-plan discount. Pro 20% ⇒ 200 000/mo-equiv,
// Pro+ 25% ⇒ 375 000/mo-equiv (at the default 250 000 / 500 000 monthly prices).
export const ANNUAL_DISCOUNT_PCT: Record<PlanKey, number> = {
  pro:      20,
  pro_plus: 25,
}

// Yearly total in tiyin, computed from the monthly price + the plan's discount.
// This is the amount charged once for a 12-month subscription. Always derived —
// change the monthly above and this follows automatically.
export function planAnnualTotalTiyin(plan: PlanKey): number {
  return Math.round((PLAN_PRICES_TIYIN[plan].monthly * 12 * (100 - ANNUAL_DISCOUNT_PCT[plan])) / 100)
}

// DISPLAY-ONLY dollar reference for the "≈ $N/mo" secondary label. Never charged.
export const PLAN_PRICES_USD_DISPLAY: Record<PlanKey, number> = {
  pro:      20,
  pro_plus: 40,
}

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
