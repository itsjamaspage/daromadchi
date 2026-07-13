import { Bell } from 'lucide-react'
import { getStockAlerts, getAlertSettings } from '@/lib/db/alerts'
import StockAlertsView from '@/components/dashboard/StockAlertsView'
import { getT } from '@/lib/server-i18n'

export default async function AlertsPage() {
  const [t, alerts, settings] = await Promise.all([getT(), getStockAlerts(), getAlertSettings()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center">
          <Bell className="w-5 h-5 text-[var(--c1)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.alertsTitle}</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.alertsSubtitle}</p>
        </div>
      </div>

      <StockAlertsView alerts={alerts} settings={settings} />
    </div>
  )
}
