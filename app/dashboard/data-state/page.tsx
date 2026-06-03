import { getT } from '@/lib/server-i18n'
import DataStateView from '@/components/dashboard/DataStateView'
import { getSyncDays } from '@/lib/db/sync-state'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function DataStatePage() {
  const [t, days] = await Promise.all([getT(), getSyncDays(30)])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.dataStateTitle}</h1>
          <HelpTooltip section="dataState" />
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.dataStateSubtitle}</p>
      </div>
      <DataStateView days={days} />
    </div>
  )
}
