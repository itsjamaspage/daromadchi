import { getBilling } from '@/lib/db/billing'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const billing = await getBilling()
  return <BillingClient billing={billing} />
}
