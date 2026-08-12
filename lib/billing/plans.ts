export type PlanKey = 'pro' | 'pro_plus'
export type Period  = 'monthly' | 'annual'

// SOURCE OF TRUTH: subscription prices are denominated in USD. The UZS figures
// shown to users are DERIVED at request time from the live USD→UZS rate
// (lib/billing/fx.ts) and rounded to a clean so'm amount — so the displayed price
// tracks the exchange rate instead of drifting from a hardcoded number.
export const PLAN_PRICES_USD: Record<PlanKey, number> = {
  pro:      20,   // $/month
  pro_plus: 40,   // $/month
}

// Annual billing = 3 months free: you pay for 9 of the 12 months. Applied to the
// per-month figure shown when the annual toggle is on.
export const ANNUAL_MONTHS_PAID  = 9
export const ANNUAL_MONTHS_TOTAL = 12

export const PLAN_MONTHS: Record<Period, number> = { monthly: 1, annual: 12 }

// Round a raw UZS amount to the nearest 1000 so'm for a clean displayed price.
export function roundUzs(uzs: number): number {
  return Math.round(uzs / 1000) * 1000
}

// Monthly USD price → clean UZS figure at the given USD→UZS rate.
export function usdMonthlyToUzs(usd: number, rate: number): number {
  return roundUzs(usd * rate)
}

// The per-month price shown on the annual toggle (3 months free), from a monthly
// UZS figure. Rounded to a clean so'm amount.
export function annualMonthlyUzs(monthlyUzs: number): number {
  return roundUzs((monthlyUzs * ANNUAL_MONTHS_PAID) / ANNUAL_MONTHS_TOTAL)
}

export function planExpiresAt(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
