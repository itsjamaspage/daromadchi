import { FileText, Link2, Settings } from 'lucide-react'
import Link from 'next/link'
import { getMonthlyPnl } from '@/lib/db/pnl'
import PnlChart from './PnlChart'
import ExportButton from '@/components/dashboard/ExportButton'
import { getT } from '@/lib/server-i18n'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

export default async function PnlPage() {
  const t = await getT()
  const d = t.dashboard
  const monthlyData = await getMonthlyPnl(6)
  const isEmpty = monthlyData.length === 0

  const totalRevenue  = monthlyData.reduce((s, m) => s + m.revenue, 0)
  const totalFees     = monthlyData.reduce((s, m) => s + m.marketplace_fee, 0)
  const totalDelivery = monthlyData.reduce((s, m) => s + m.delivery_cost, 0)
  const totalNet      = monthlyData.reduce((s, m) => s + m.net, 0)
  const avgMargin     = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0

  const exportData = monthlyData.map(m => ({
    [d.month]:                m.month,
    [`${d.revenue} (so'm)`]:  Math.round(m.revenue),
    [`${d.commission2} (so'm)`]: Math.round(m.marketplace_fee),
    [`${d.delivery} (so'm)`]: Math.round(m.delivery_cost),
    [`${d.net} (so'm)`]:      Math.round(m.net),
    [d.ordersCol]:            m.order_count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-2">
              <FileText className="w-6 h-6 text-violet-400" />
              {d.pnlTitle}
            </h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {isEmpty ? d.pnlSubtitleEmpty : d.pnlSubtitle}
          </p>
        </div>
        {!isEmpty && <ExportButton data={exportData} filename="pnl-hisoboti" />}
      </div>

      {isEmpty ? (
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">{d.noData}</h2>
          <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">
            {d.noDataPnlDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: d.totalRevenuePnl,   value: fmt(totalRevenue), color: 'text-violet-400' },
              { label: d.commission2,        value: fmt(totalFees),    color: 'text-red-400' },
              { label: d.delivery,           value: fmt(totalDelivery),color: 'text-amber-400' },
              { label: d.netNoCommission,    value: fmt(totalNet),     color: totalNet > 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
                <p className="text-[var(--text-muted)] text-xs mb-2">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Note about COGS */}
          <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400/80">
            <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {d.cogsNote}
            </span>
          </div>

          {/* Chart */}
          <PnlChart data={monthlyData.map(m => ({
            month:    m.month,
            revenue:  m.revenue,
            cost:     m.marketplace_fee + m.delivery_cost,
            adSpend:  0,
            profit:   m.net,
          }))} />

          {/* Monthly table */}
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                    <th className="text-left font-medium px-5 py-3">{d.month}</th>
                    <th className="text-right font-medium px-5 py-3">{d.ordersCol}</th>
                    <th className="text-right font-medium px-5 py-3">{d.revenue}</th>
                    <th className="text-right font-medium px-5 py-3">{d.commission2}</th>
                    <th className="text-right font-medium px-5 py-3">{d.delivery}</th>
                    <th className="text-right font-medium px-5 py-3">{d.net}</th>
                    <th className="text-right font-medium px-5 py-3">{d.margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {monthlyData.map((m, i) => {
                    const margin = m.revenue > 0 ? (m.net / m.revenue) * 100 : 0
                    return (
                      <tr key={m.month} className={`hover:bg-[var(--bg-card2)] transition-colors ${i === monthlyData.length - 1 ? 'bg-[var(--bg-card2)]' : ''}`}>
                        <td className="px-5 py-4 text-[var(--text-base)] font-medium">
                          {m.month}
                          {i === monthlyData.length - 1 && (
                            <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{d.current}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right text-[var(--text-muted)]">{m.order_count}</td>
                        <td className="px-5 py-4 text-right text-[var(--text-dim)]">{fmt(m.revenue)}</td>
                        <td className="px-5 py-4 text-right text-red-400/70">{m.marketplace_fee > 0 ? fmt(m.marketplace_fee) : '—'}</td>
                        <td className="px-5 py-4 text-right text-amber-400/70">{m.delivery_cost > 0 ? fmt(m.delivery_cost) : '—'}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-bold ${m.net > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(m.net)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-sm font-semibold ${margin > 80 ? 'text-emerald-400' : margin > 60 ? 'text-amber-400' : 'text-red-400'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals */}
                  <tr className="bg-[var(--bg-card2)] border-t border-[var(--border2)]">
                    <td className="px-5 py-4 text-[var(--text-base)] font-bold text-xs uppercase tracking-wide">{d.total}</td>
                    <td className="px-5 py-4 text-right text-[var(--text-dim)] font-bold">{monthlyData.reduce((s, m) => s + m.order_count, 0)}</td>
                    <td className="px-5 py-4 text-right text-[var(--text-base)] font-bold">{fmt(totalRevenue)}</td>
                    <td className="px-5 py-4 text-right text-red-400 font-bold">{fmt(totalFees)}</td>
                    <td className="px-5 py-4 text-right text-amber-400 font-bold">{fmt(totalDelivery)}</td>
                    <td className="px-5 py-4 text-right"><span className="text-emerald-400 font-bold">{fmt(totalNet)}</span></td>
                    <td className="px-5 py-4 text-right"><span className="text-emerald-400 font-bold">{avgMargin.toFixed(1)}%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
