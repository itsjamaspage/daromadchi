import { FileText, Link2, Settings } from 'lucide-react'
import Link from 'next/link'
import { getMonthlyPnl } from '@/lib/db/pnl'
import PnlChart from './PnlChart'
import ExportButton from '@/components/dashboard/ExportButton'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

export default async function PnlPage() {
  const monthlyData = await getMonthlyPnl(6)
  const isEmpty = monthlyData.length === 0
  const lang = await getLang()
  const t = dashT[lang].pnl

  const totalRevenue  = monthlyData.reduce((s, m) => s + m.revenue, 0)
  const totalFees     = monthlyData.reduce((s, m) => s + m.marketplace_fee, 0)
  const totalDelivery = monthlyData.reduce((s, m) => s + m.delivery_cost, 0)
  const totalNet      = monthlyData.reduce((s, m) => s + m.net, 0)
  const avgMargin     = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0

  const exportData = monthlyData.map(m => ({
    [t.colMonth]: m.month,
    [t.colRevenue]:      Math.round(m.revenue),
    [t.colCommission]:    Math.round(m.marketplace_fee),
    [t.colDelivery]: Math.round(m.delivery_cost),
    [t.colNet]:          Math.round(m.net),
    [t.colOrders]:         m.order_count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-400" />
            {t.title}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isEmpty ? t.subtitleEmpty : t.subtitle}
          </p>
        </div>
        {!isEmpty && <ExportButton data={exportData} filename={t.exportFilename} />}
      </div>

      {isEmpty ? (
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">{t.empty}</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            {t.emptyDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> {t.goSettings}
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t.totalRevenue, value: fmt(totalRevenue), color: 'text-violet-400' },
              { label: t.commission,   value: fmt(totalFees),    color: 'text-red-400' },
              { label: t.delivery,     value: fmt(totalDelivery),color: 'text-amber-400' },
              { label: t.netNoComm,    value: fmt(totalNet),     color: totalNet > 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-2">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Note about COGS */}
          <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400/80">
            <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {t.cogsNote}
            </span>
          </div>

          {/* Chart */}
          <PnlChart
            title={t.chartTitle}
            subtitle={t.chartSubtitle}
            revenueLabel={t.chartRevenue}
            profitLabel={t.chartProfit}
            data={monthlyData.map(m => ({
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
                  <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                    <th className="text-left font-medium px-5 py-3">{t.month}</th>
                    <th className="text-right font-medium px-5 py-3">{t.orders}</th>
                    <th className="text-right font-medium px-5 py-3">{t.revenue}</th>
                    <th className="text-right font-medium px-5 py-3">{t.commission}</th>
                    <th className="text-right font-medium px-5 py-3">{t.delivery}</th>
                    <th className="text-right font-medium px-5 py-3">{t.net}</th>
                    <th className="text-right font-medium px-5 py-3">{t.margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {monthlyData.map((m, i) => {
                    const margin = m.revenue > 0 ? (m.net / m.revenue) * 100 : 0
                    return (
                      <tr key={m.month} className={`hover:bg-white/[0.02] transition-colors ${i === monthlyData.length - 1 ? 'bg-white/[0.01]' : ''}`}>
                        <td className="px-5 py-4 text-white font-medium">
                          {m.month}
                          {i === monthlyData.length - 1 && (
                            <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{t.current}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-400">{m.order_count}</td>
                        <td className="px-5 py-4 text-right text-slate-300">{fmt(m.revenue)}</td>
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
                  <tr className="bg-white/[0.03] border-t border-[var(--border2)]">
                    <td className="px-5 py-4 text-white font-bold text-xs uppercase tracking-wide">{t.total}</td>
                    <td className="px-5 py-4 text-right text-slate-300 font-bold">{monthlyData.reduce((s, m) => s + m.order_count, 0)}</td>
                    <td className="px-5 py-4 text-right text-white font-bold">{fmt(totalRevenue)}</td>
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
