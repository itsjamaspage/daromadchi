'use client'

import { useState, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import { TrendingUp, Package } from 'lucide-react'
import type { ProductSeasonality } from '@/lib/mock-reviews-seasonality'
import ExportButton from '@/components/dashboard/ExportButton'

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
      <div className="bg-[#0d0d1a] border border-white/[0.08] rounded-xl p-3 shadow-xl text-xs">
        <p className="text-white font-semibold mb-2">{label}</p>
        <p className="text-violet-400">Daromad: <span className="font-bold">{formatSom(payload[0].value)}</span></p>
        <p className="text-slate-400">Buyurtmalar: <span className="text-white font-semibold">{d.orders} ta</span></p>
        <p className="text-slate-400">O&apos;rtacha chek: <span className="text-white font-semibold">{formatSom(d.avgCheck)}</span></p>
      </div>
    )
  }

  const exportData = product.data.map(d => ({
    'Oy':              d.month,
    "Daromad (so'm)":  d.revenue,
    'Buyurtmalar':     d.orders,
    "O'rtacha chek":   d.avgCheck,
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
                  : 'bg-[#13131f] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10'
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
          { label: 'Eng yaxshi oy',   value: product.peakMonth,        color: 'text-violet-400', sub: 'Ko\'proq zaxira oling' },
          { label: 'Eng past oy',     value: product.lowMonth,         color: 'text-slate-400',  sub: 'Zaxirani kamaytiring' },
          { label: 'O\'sish',          value: `+${product.growthPct}%`, color: 'text-emerald-400',sub: 'Yillik trend' },
          { label: 'Kategoriya',      value: product.category,         color: 'text-white',      sub: product.productTitle },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-semibold text-sm">{product.productTitle}</p>
            <p className="text-slate-500 text-xs mt-0.5">12 oylik sotuv daromadi</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <TrendingUp className="w-4 h-4" />
            +{product.growthPct}% o&apos;sish
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
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-sm" style={{ background: PEAK_COLOR }} />
            Eng yuqori oy
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-sm" style={{ background: LOW_COLOR }} />
            Eng past oy
          </span>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Oy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Daromad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Buyurtmalar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">O&apos;rtacha chek</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Faollik</th>
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
                      <span className="text-white text-xs font-medium">{d.month}</span>
                      {isPeak && <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">Eng yaxshi</span>}
                      {isLow  && <span className="ml-2 text-[10px] text-slate-500 bg-slate-700/20 px-1.5 py-0.5 rounded">Eng past</span>}
                    </td>
                    <td className="px-4 py-3 text-white text-xs font-semibold">{formatSom(d.revenue)}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{d.orders} ta</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatSom(d.avgCheck)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PEAK_COLOR }} />
                        </div>
                        <span className="text-[10px] text-slate-600 tabular-nums">{Math.round(pct)}%</span>
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
        <p className="text-violet-300 font-semibold text-sm mb-2">Tavsiya</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          <strong className="text-white">{product.peakMonth}</strong> oyida eng yuqori sotuv kuzatiladi.
          Shu oydan <strong className="text-white">1–2 oy oldin</strong> yetarli zaxira to&apos;plang.
          {product.lowMonth !== product.peakMonth && (
            <> <strong className="text-white">{product.lowMonth}</strong> oyida sotuv pasayadi — bu davrda reklama xarajatini kamaytiring.</>
          )}
        </p>
      </div>
    </div>
  )
}
