'use client'

import { useState, useRef, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import { TrendingUp, Package } from 'lucide-react'
import type { ProductSeasonality } from '@/lib/db/seasonality'
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

  const [axisColor, setAxisColor] = useState('#64748b')
  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
    setAxisColor(isDark ? '#64748b' : '#3a4550')
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.getAttribute('data-theme') !== 'light'
      setAxisColor(dark ? '#64748b' : '#3a4550')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const maxRevenue = Math.max(...product.data.map(d => d.revenue))
  const minRevenue = Math.min(...product.data.map(d => d.revenue))

  function barColor(revenue: number) {
    if (revenue === maxRevenue) return PEAK_COLOR
    if (revenue === minRevenue) return LOW_COLOR
    const pct = (revenue - minRevenue) / (maxRevenue - minRevenue)
    return pct > 0.6 ? '#7c3aed' : pct > 0.3 ? '#a78bfa' : '#c4b5fd'
  }

  const CustomTooltip = ({ active, payload, label }: {active?: boolean; payload?: {value: number; payload: {orders: number; avgCheck: number}}[]; label?: string}) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl p-3 shadow-xl text-xs">
        <p className="text-[var(--text-base)] font-semibold mb-2">{label}</p>
        <p className="text-[#83c0f9]">Daromad: <span className="font-bold">{formatSom(payload[0].value)}</span></p>
        <p className="text-[var(--text-muted)]">Buyurtmalar: <span className="text-[var(--text-base)] font-semibold">{d.orders} ta</span></p>
        <p className="text-[var(--text-muted)]">O&apos;rtacha chek: <span className="text-[var(--text-base)] font-semibold">{formatSom(d.avgCheck)}</span></p>
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
                  ? 'bg-[rgba(131,192,249,0.15)] border-[var(--c1)]'
                  : 'bg-[var(--bg-card2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-base)] hover:border-[rgba(131,192,249,0.5)]'
              }`}
              style={selectedIdx === i ? { color: 'var(--c1)' } : {}}>
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
          { label: 'Eng yaxshi oy',   value: product.peakMonth,        color: 'text-[#83c0f9]', sub: 'Ko\'proq zaxira oling' },
          { label: 'Eng past oy',     value: product.lowMonth,         color: 'text-[var(--text-muted)]',  sub: 'Zaxirani kamaytiring' },
          { label: 'O\'sish',          value: `+${product.growthPct}%`, color: 'text-emerald-400',sub: 'Yillik trend' },
          { label: 'Kategoriya',      value: product.category,         color: 'text-[var(--text-base)]',      sub: product.productTitle },
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
            <p className="text-[var(--text-muted)] text-xs mt-0.5">12 oylik sotuv daromadi</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <TrendingUp className="w-4 h-4" />
            +{product.growthPct}% {t.growthLabel}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={product.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fs} tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
            <Bar dataKey="revenue" radius={[4,4,0,0]}>
              {product.data.map((d, i) => (
                <Cell key={i} fill={barColor(d.revenue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--border)]">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Oy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Daromad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Buyurtmalar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">O&apos;rtacha chek</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Faollik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {product.data.map((d, i) => {
                const isPeak = d.revenue === maxRevenue
                const isLow  = d.revenue === minRevenue
                const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                return (
                  <tr key={i} className={`hover:bg-[var(--bg-card2)] transition-colors ${isPeak ? 'bg-[#83c0f9]/5' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-base)] text-xs font-medium">{d.month}</span>
                      {isPeak && <span className="ml-2 text-[10px] text-[#83c0f9] bg-[rgba(131,192,249,0.12)] px-1.5 py-0.5 rounded">Eng yaxshi</span>}
                      {isLow  && <span className="ml-2 text-[10px] text-[var(--text-muted)] bg-[var(--bg-card2)] px-1.5 py-0.5 rounded">Eng past</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-base)] text-xs font-semibold">{formatSom(d.revenue)}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)] text-xs">{d.orders} ta</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{formatSom(d.avgCheck)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[var(--bg-card2)] rounded-full overflow-hidden max-w-[80px]">
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
      <div className="bg-[#83c0f9]/15 border border-[#83c0f9]/40 rounded-2xl px-5 py-4">
        <p className="font-semibold text-sm mb-2" style={{ color: 'var(--c1)' }}>Tavsiya</p>
        <p className="text-[var(--text-base)] text-xs leading-relaxed">
          <strong style={{ color: 'var(--c1)' }}>{product.peakMonth}</strong> oyida eng yuqori sotuv kuzatiladi.
          Shu oydan <strong style={{ color: 'var(--c1)' }}>1–2 oy oldin</strong> yetarli zaxira to&apos;plang.
          {product.lowMonth !== product.peakMonth && (
            <> <strong style={{ color: 'var(--c1)' }}>{product.lowMonth}</strong> oyida sotuv pasayadi — bu davrda reklama xarajatini kamaytiring.</>
          )}
        </p>
      </div>
    </div>
  )
}
