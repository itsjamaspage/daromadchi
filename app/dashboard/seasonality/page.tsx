import { CalendarDays } from 'lucide-react'
import ComingSoon from '@/components/dashboard/ComingSoon'
import { getT } from '@/lib/server-i18n'

// Section temporarily disabled — awaiting redesign. See ComingSoon component
// for the placeholder. Re-enable by restoring the previous SeasonalityView +
// getSeasonality query.
export default async function SeasonalityPage() {
  const t = await getT()
  const d = t.dashboard
  return <ComingSoon title={d.nav.seasonality} icon={CalendarDays} />
}
