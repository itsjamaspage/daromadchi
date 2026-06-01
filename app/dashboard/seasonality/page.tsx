import { getT } from '@/lib/server-i18n'
import { CalendarDays } from 'lucide-react'
import { seasonalityData } from '@/lib/mock-reviews-seasonality'
import SeasonalityView from '@/components/dashboard/SeasonalityView'

export default async function SeasonalityPage() {
  const t = await getT()
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-violet-400" />
          {d.seasonalityTitle}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{d.seasonalitySubtitle}</p>
      </div>
      <SeasonalityView data={seasonalityData} />
    </div>
  )
}
