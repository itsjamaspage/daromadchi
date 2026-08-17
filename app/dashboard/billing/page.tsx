import { getBilling } from '@/lib/db/billing'
import BillingClient from './BillingClient'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function BillingPage({ searchParams }: Props) {
  const [billing, params] = await Promise.all([getBilling(), searchParams])
  // ?plan=pro|pro_plus arrives from /pricing (via login). When present, open the
  // plan chooser straight away with that plan highlighted so the user can pay
  // without hunting for the button. Ignore anything that isn't a paid key.
  const initialPlan =
    params?.plan === 'pro' || params?.plan === 'pro_plus' ? params.plan : undefined
  return <BillingClient billing={billing} initialPlan={initialPlan} />
}
