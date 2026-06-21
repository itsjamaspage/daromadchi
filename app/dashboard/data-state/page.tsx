import { createClient } from '@/lib/supabase/server'
import { getT } from '@/lib/server-i18n'
import DataStateView from '@/components/dashboard/DataStateView'
import { getSyncDays } from '@/lib/db/sync-state'

export default async function DataStatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [t, uzumDays, yandexDays, wbDays] = await Promise.all([
    getT(),
    getSyncDays('uzum', 30),
    getSyncDays('yandex_market', 30),
    getSyncDays('wildberries', 30),
  ])

  const connectedMps: string[] = []
  if (user) {
    const { data: shops } = await supabase
      .from('shops')
      .select('marketplace')
      .eq('user_id', user.id)
      .neq('shop_id_external', 'DEMO')
    shops?.forEach(s => { if (!connectedMps.includes(s.marketplace)) connectedMps.push(s.marketplace) })
  }

  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.dataStateTitle}</h1>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.dataStateSubtitle}</p>
      </div>
      <DataStateView
        uzumDays={uzumDays}
        yandexDays={yandexDays}
        wbDays={wbDays}
        connectedMps={connectedMps}
      />
    </div>
  )
}
