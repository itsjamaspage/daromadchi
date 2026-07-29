import ComingSoon from '@/components/dashboard/ComingSoon'
import { getT } from '@/lib/server-i18n'

export default async function AdvertisingPage() {
  const t = await getT()
  const d = t.dashboard
  return <ComingSoon title={d.nav.advertising} icon="advertising" />
}
