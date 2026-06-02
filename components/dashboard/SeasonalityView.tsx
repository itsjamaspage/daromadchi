'use client'

import { useState, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import { TrendingUp, Package } from 'lucide-react'
import type { ProductSeasonality } from '@/lib/mock-reviews-seasonality'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function fs(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' mln'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + ' ming'
  return String(n)
}

function formatSom(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

const PEAK_COLOR   = '#7c3aed'
const NORMAL_COLOR = '#4c1d95'
const LOW_COLOR    = '#1e1b4b'

interface Props { data: ProductSeasonality[] }

export default function SeasonalityView({ data }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].seasonality
  const [selectedIdx, setSelectedIdx] = useState(0)
  const printRef = useRef<HTMLDivElement>(null)
  const product = data[selectedIdx]

  const maxRevenue = Math.max(...product.data.map(d => d.revenue))
  const minRevenue = Math.min(...product.data.map(d => d.revenue))

  function barColor(revenue: number) {
    if (revenue === maxRevenue) return PEAK_COLOR
    if (revenue === minRevenue) return LOW_COLOR
    const pct = (revenue - minRevenue) / (maxRevenue - minRevenue)
    return pct > 0.6 ? '#6d28d9' : pct > 0.3 ? '#4c1d95' : '#2e1065'
  }

  const CustomTooltip = ({ active, payload, label }: {active?: boolean; payload?: {value: number; payload: {orders: number; avgCheck: number}}[]; label?: string}) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[var(--bg-base)] border border-[var(--border2)] rounded-xl p-3 shadow-xl text-xs">
        <p className="text-[var(--text-base)] font-semibold mb-2">{label}</p>
        <p className="text-violet-400">{t.tooltipRevenue} <span className="font-bold">{formatSom(payload[0].value)}</span></p>
        <p className="text-[var(--text-muted)]">{t.tooltipOrders} <span className="text-[var(--text-base)] font-semibold">{d.orders}</span></p>
        <p className="text-[var(--text-muted)]">{t.tooltipAvgCheck} <span className="text-[var(--text-base)] font-semibold">{formatSom(d.avgCheck)}</span></p>
      </div>
    )
  }

  const exportData = product.data.map(d => ({
    [t.colMonth]:              d.month,
    [`${t.colRevenue} (so'm)`]: d.revenue,
    [t.colOrders]:             d.orders,
    [t.colAvgCheck]:           d.avgCheck,
  }))

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Product selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-2 flex-1">
          {data.map((p, i) => (
            <button key={p.productId} onClick={() => setSelectedIdx(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                selectedIdx === i
                  ? 'bg-violet-600/20 border-violet-500/30 text-violet-300'
                  : 'bg-[var(--bg-card2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-base)] hover:border-white/10'
              }`}>
              <Package className="w-3.5 h-3.5" />
              {p.productTitle}
            </button>
          ))}
        </div>
        <ExportButton data={exportData} filename={`mavsumiylik-${product.productTitle.replace(/\s+/g, '-')}`} targetRef={printRef} />
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.insightBest,     value: product.peakMonth,        color: 'text-violet-400',            sub: t.insightBestSub },
          { label: t.insightLow,      value: product.lowMonth,         color: 'text-[var(--text-muted)]',   sub: t.insightLowSub  },
          { label: t.insightGrowth,   value: `+${product.growthPct}%`, color: 'text-emerald-400',           sub: t.insightGrowthSub },
          { label: t.insightCategory, value: product.category,         color: 'text-[var(--text-base)]',    sub: product.productTitle },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[var(--text-base)] font-semibold text-sm">{product.productTitle}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">{t.chartSubtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <TrendingUp className="w-4 h-4" />
            +{product.growthPct}% {t.growthLabel}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={product.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fs} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
            <Bar dataKey="revenue" radius={[4,4,0,0]}>
              {product.data.map((d, i) => (
                <Cell key={i} fill={barColor(d.revenue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/[0.05]">
          <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded-sm" style={{ background: PEAK_COLOR }} />
            {t.legendPeak}
          </span>
          <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded-sm" style={{ background: LOW_COLOR }} />
            {t.legendLow}
          </span>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">{t.colMonth}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">{t.colRevenue}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">{t.colOrders}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">{t.colAvgCheck}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">{t.colActivity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {product.data.map((d, i) => {
                const isPeak = d.revenue === maxRevenue
                const isLow  = d.revenue === minRevenue
                const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                return (
                  <tr key={i} className={`hover:bg-white/[0.02] transition-colors ${isPeak ? 'bg-violet-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-base)] text-xs font-medium">{d.month}</span>
                      {isPeak && <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{t.tagBest}</span>}
                      {isLow  && <span className="ml-2 text-[10px] text-[var(--text-muted)] bg-slate-700/20 px-1.5 py-0.5 rounded">{t.tagLow}</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-base)] text-xs font-semibold">{formatSom(d.revenue)}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)] text-xs">{d.orders} ta</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{formatSom(d.avgCheck)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PEAK_COLOR }} />
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{Math.round(pct)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation box */}
      <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl px-5 py-4">
        <p className="text-violet-300 font-semibold text-sm mb-2">{t.recTitle}</p>
        <p className="text-[var(--text-muted)] text-xs leading-relaxed">
          <strong className="text-[var(--text-base)]">{product.peakMonth}</strong> {t.recPeak1}{' '}
          <strong className="text-[var(--text-base)]">{t.recPeak2}</strong> {t.recPeak3}
          {product.lowMonth !== product.peakMonth && (
            <> <strong className="text-[var(--text-base)]">{product.lowMonth}</strong> {t.recLow1}</>
          )}
        </p>
      </div>
    </div>
  )
}
