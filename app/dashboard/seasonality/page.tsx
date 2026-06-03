import { getT } from '@/lib/server-i18n'
import { CalendarDays } from 'lucide-react'
import { seasonalityData } from '@/lib/mock-reviews-seasonality'
import SeasonalityView from '@/components/dashboard/SeasonalityView'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function SeasonalityPage() {
  const t = await getT()
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-violet-400" />
            {d.seasonalityTitle}
          </h1>
          <HelpTooltip section="seasonality" />
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.seasonalitySubtitle}</p>
      </div>
      <SeasonalityView data={seasonalityData} />
    </div>
  )
}
