import { getT } from '@/lib/server-i18n'
import DataStateView from '@/components/dashboard/DataStateView'
import { getSyncDays } from '@/lib/db/sync-state'

export default async function DataStatePage() {
  const [t, days] = await Promise.all([getT(), getSyncDays(30)])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{d.dataStateTitle}</h1>
        <p className="text-slate-400 text-sm mt-1">{d.dataStateSubtitle}</p>
      </div>
      <DataStateView days={days} />
    </div>
  )
}
