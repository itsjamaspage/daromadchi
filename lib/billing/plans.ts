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
// Agreed anchor (confirmed, deliberate so'm price — NOT a USD-derived number):
// Pro 250 000 so'm/mo, Pro+ 500 000 so'm/mo. Annual is billed with 3 months free
// (pay 9 of 12): annualTotal = monthly × 9 → 2 250 000 / 4 500 000 so'm.
// ─────────────────────────────────────────────────────────────────────────────
export const PLAN_PRICES_TIYIN: Record<PlanKey, { monthly: number; annualTotal: number }> = {
  pro:      { monthly: 5_000_000, annualTotal: 225_000_000 }, // TEMP TEST: 50 000 so'm/mo (revert to 25_000_000 = 250 000) — annual unchanged
  pro_plus: { monthly: 50_000_000, annualTotal: 450_000_000 }, // 500 000 / 4 500 000 so'm
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
  const p = PLAN_PRICES_TIYIN[plan]
  return interval === 'annual' ? p.annualTotal : p.monthly
}

// How many months a plan+interval covers (for subscription period math).
export function planPeriodMonths(interval: Interval): number {
  return interval === 'annual' ? 12 : 1
}

// tiyin → "252 000" (so'm, space-grouped thousands). Display only.
export function formatSomFromTiyin(tiyin: number): string {
  return String(tiyinToSom(tiyin)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// The per-month so'm figure shown on the annual toggle (annualTotal / 12).
export function annualMonthlySom(plan: PlanKey): number {
  return Math.round(tiyinToSom(PLAN_PRICES_TIYIN[plan].annualTotal) / 12)
}

export function planExpiresAt(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
