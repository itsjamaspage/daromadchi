export type PlanKey = 'pro' | 'pro_plus'
export type Period  = 'monthly' | 'annual'

// Prices in UZS (so'm)
export const PLAN_PRICES: Record<PlanKey, Record<Period, number>> = {
  pro:      { monthly: 300_000, annual: 3_000_000 },  // annual = 10 months price
  pro_plus: { monthly: 600_000, annual: 6_000_000 },
}

export const PLAN_MONTHS: Record<Period, number> = { monthly: 1, annual: 12 }

export function planExpiresAt(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
