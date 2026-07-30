import ComingSoon from '@/components/dashboard/ComingSoon'
import { getT } from '@/lib/server-i18n'

export default async function TeamPage() {
  const t = await getT()
  const d = t.dashboard
  return <ComingSoon title={d.nav.team} icon="team" />
}
