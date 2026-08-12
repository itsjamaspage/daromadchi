import { getUsdToUzsRate } from '@/lib/billing/fx'
import { PLAN_PRICES_TIYIN, tiyinToSom, annualMonthlySom, type PlanKey } from '@/lib/billing/plans'
import PricingClient, { type PricingData } from './PricingClient'

// Regenerate daily. The DISPLAYED so'm prices are FIXED (from PLAN_PRICES_TIYIN);
// only the secondary "≈ $N" label tracks the live FX rate — it never affects the
// charged amount.
export const revalidate = 86400

export default async function PricingPage() {
  const rate = await getUsdToUzsRate()

  const build = (key: PlanKey) => {
    const monthly = tiyinToSom(PLAN_PRICES_TIYIN[key].monthly) // FIXED so'm (the charged basis)
    const yearly  = annualMonthlySom(key)                      // FIXED so'm/mo when billed annually
    const usd     = Math.max(1, Math.round(monthly / rate))    // DISPLAY-ONLY ≈ $N
    return { usd, monthly, yearly }
  }

  const prices: PricingData = {
    pro:      build('pro'),
    pro_plus: build('pro_plus'),
  }

  return <PricingClient prices={prices} />
}
