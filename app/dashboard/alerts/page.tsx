import { Bell } from 'lucide-react'
import { getStockAlerts, getAlertSettings } from '@/lib/db/alerts'
import StockAlertsView from '@/components/dashboard/StockAlertsView'
import { getT } from '@/lib/server-i18n'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function AlertsPage() {
  const t = await getT()
  const d = t.dashboard
  const [alerts, settings] = await Promise.all([
    getStockAlerts(),
    getAlertSettings(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.alertsTitle}</h1>
            <HelpTooltip section="alerts" />
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.alertsSubtitle}</p>
        </div>
      </div>

      <StockAlertsView alerts={alerts} settings={settings} />
    </div>
  )
}
