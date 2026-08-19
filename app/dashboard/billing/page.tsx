import { getBilling } from '@/lib/db/billing'
import BillingClient from './BillingClient'
import { isPlanKey } from '@/lib/billing/plans'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function BillingPage({ searchParams }: Props) {
  const [billing, params] = await Promise.all([getBilling(), searchParams])
  // ?plan=… arrives from /pricing (via login). When present, open the plan
  // chooser straight away with that plan highlighted so the user can pay without
  // hunting for the button. Validated against the price table, so every plan
  // /pricing links to actually opens.
  const initialPlan = isPlanKey(params?.plan) ? params.plan : undefined
  // ?interval=annual (from the yearly toggle on the pricing cards) opens the
  // chooser on the yearly option so the confirm popup shows the once-a-year total.
  const initialInterval =
    params?.interval === 'annual' || params?.interval === 'monthly' ? params.interval : undefined
  return <BillingClient billing={billing} initialPlan={initialPlan} initialInterval={initialInterval} />
}
