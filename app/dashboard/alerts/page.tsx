import { Bell } from 'lucide-react'
import { getStockAlerts, getAlertSettings } from '@/lib/db/alerts'
import StockAlertsView from '@/components/dashboard/StockAlertsView'

export default async function AlertsPage() {
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
          <h1 className="text-2xl font-bold text-white">Ogohlantirishlar</h1>
          <p className="text-slate-400 text-sm">Ombordagi kritik mahsulotlar va qoldiq nazorati</p>
        </div>
      </div>

      <StockAlertsView alerts={alerts} settings={settings} />
    </div>
  )
}
