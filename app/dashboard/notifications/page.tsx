import { Bell, Package, AlertTriangle, ShoppingCart } from 'lucide-react'
import { getT } from '@/lib/server-i18n'
import { getStockAlerts } from '@/lib/db/alerts'
import { getOrderNotifications } from '@/lib/db/order-notifications'
import { groupStockAlerts } from '@/lib/stock-alert-group'
import MarkNotificationsSeen from '@/components/dashboard/MarkNotificationsSeen'

const MP_LABEL: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex Market' }

export default async function NotificationsPage() {
  const [t, rawAlerts, orderNotifs] = await Promise.all([
    getT(),
    getStockAlerts(),
    getOrderNotifications(),
  ])
  const d = t.dashboard
  // One row per physical product, not per listing — see lib/stock-alert-group.ts.
  const alerts = groupStockAlerts(rawAlerts)
  const total = alerts.length + orderNotifs.length

  const money = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

  return (
    <div className="space-y-6">
      {/* Opening this page marks the current notifications as seen → clears the bell badge. */}
      <MarkNotificationsSeen count={total} />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center">
          <Bell className="w-5 h-5 text-[var(--c1)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.notificationsTitle}</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.notificationsSubtitle}</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            <Bell className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.notifEmpty}</h2>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>{d.notifEmptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Sales: orders waiting on the seller ─────────────────────────── */}
          {orderNotifs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-2 px-1">
                {d.notifOrdersHeading} · {orderNotifs.length}
              </h2>
              <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
                {orderNotifs.map(o => (
                  <a
                    key={o.orderId}
                    href="/dashboard/orders"
                    className="flex items-start gap-3 px-5 py-4 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/10">
                      <ShoppingCart className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-base)] text-sm font-medium truncate">
                        #{o.externalId} · {MP_LABEL[o.marketplace] ?? o.marketplace}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">
                        {o.itemTitles.length > 0
                          ? o.itemTitles.slice(0, 3).join(', ')
                          : `${o.itemsCount} ${d.unitsSuffix}`}
                        {o.revenue > 0 && ` · ${money(o.revenue)}`}
                      </p>
                    </div>
                    {/* An order the Telegram bot never announced is the one the
                        seller is most likely to have missed — say so. */}
                    {!o.alerted && (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        {d.notifOrderNotAlerted}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ── Inventory ───────────────────────────────────────────────────── */}
          {alerts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-2 px-1">
                {d.notifStockHeading} · {alerts.length}
              </h2>
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
            </section>
          )}
        </div>
      )}
    </div>
  )
}
