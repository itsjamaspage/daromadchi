import { getT } from '@/lib/server-i18n'
import { CalendarDays } from 'lucide-react'
import { getSeasonality } from '@/lib/db/seasonality'
import SeasonalityView from '@/components/dashboard/SeasonalityView'

export default async function SeasonalityPage() {
  const [t, data] = await Promise.all([getT(), getSeasonality()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-[#83c0f9]" />
            {d.seasonalityTitle}
          </h1>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.seasonalitySubtitle}</p>
      </div>

      {data.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <CalendarDays className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noDataYet}</h2>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>{d.noDataDesc}</p>
        </div>
      ) : (
        <SeasonalityView data={data} />
      )}
    </div>
  )
}
