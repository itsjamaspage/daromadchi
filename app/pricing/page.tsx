import { getUsdToUzsRate } from '@/lib/billing/fx'
import { PLAN_PRICES_USD, usdMonthlyToUzs, annualMonthlyUzs } from '@/lib/billing/plans'
import PricingClient, { type PricingData } from './PricingClient'

// Regenerate daily so the UZS prices track the live USD→UZS rate (the fetch in
// getUsdToUzsRate is itself cached for a day; this keeps the rendered page fresh).
export const revalidate = 86400

export default async function PricingPage() {
  const rate = await getUsdToUzsRate()

  const build = (usd: number) => {
    const monthly = usdMonthlyToUzs(usd, rate)
    return { usd, monthly, yearly: annualMonthlyUzs(monthly) }
  }

  const prices: PricingData = {
    rate,
    pro:      build(PLAN_PRICES_USD.pro),
    pro_plus: build(PLAN_PRICES_USD.pro_plus),
  }

  return <PricingClient prices={prices} />
}
