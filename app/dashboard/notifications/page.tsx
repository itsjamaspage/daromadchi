import { Bell, Package, AlertTriangle } from 'lucide-react'
import { getT } from '@/lib/server-i18n'
import { getStockAlerts } from '@/lib/db/alerts'

export default async function NotificationsPage() {
  const [t, alerts] = await Promise.all([getT(), getStockAlerts()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[rgba(131,192,249,0.15)] border border-[rgba(131,192,249,0.25)] flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#83c0f9]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.notificationsTitle}</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.notificationsSubtitle}</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            <Bell className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.notifEmpty}</h2>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>{d.notifEmptyDesc}</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
          {alerts.map(a => {
            const isCritical = a.daysLeft <= 3
            const isWarning  = a.daysLeft <= 7
            return (
              <div key={a.productId} className="flex items-start gap-3 px-5 py-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isCritical ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                }`}>
                  {isCritical
                    ? <AlertTriangle className="w-4 h-4 text-red-400" />
                    : <Package className={`w-4 h-4 ${isWarning ? 'text-amber-400' : 'text-emerald-400'}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--text-base)] text-sm font-medium">{a.productTitle}</p>
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">
                    {d.colStock}: {a.currentStock} {d.unitsSuffix} · {a.daysLeft >= 999 ? '—' : `~${a.daysLeft} ${d.daysSuffix}`}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                  isCritical ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                  isWarning  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                               'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}>
                  {isCritical ? d.statusCritical : isWarning ? d.statusWarning : d.statusWatch}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
