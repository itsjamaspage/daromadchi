'use client'

import { useState, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { CompetitorPrice } from '@/lib/mock-data'
import ExportButton from '@/components/dashboard/ExportButton'

interface Props {
  prices: CompetitorPrice[]
}

function fs(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

function positionBg(p: CompetitorPrice['pricePosition']) {
  switch (p) {
    case 'lowest':      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    case 'competitive': return 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    case 'high':        return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'highest':     return 'bg-red-500/15 text-red-400 border-red-500/20'
  }
}

function positionLabel(p: CompetitorPrice['pricePosition']) {
  switch (p) {
    case 'lowest':      return 'Eng arzon'
    case 'competitive': return 'Raqobatbardosh'
    case 'high':        return 'Qimmatroq'
    case 'highest':     return 'Eng qimmat'
  }
}

type Filter = 'all' | 'lowest' | 'competitive' | 'high-highest'

export default function PriceTrackingView({ prices }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const filtered = prices.filter(p => {
    if (filter === 'all') return true
    if (filter === 'lowest') return p.pricePosition === 'lowest'
    if (filter === 'competitive') return p.pricePosition === 'competitive'
    if (filter === 'high-highest') return p.pricePosition === 'high' || p.pricePosition === 'highest'
    return true
  })

  const lowestCount    = prices.filter(p => p.pricePosition === 'lowest').length
  const highCount      = prices.filter(p => p.pricePosition === 'high' || p.pricePosition === 'highest').length
  const avgGapPct      = prices.length > 0
    ? prices.reduce((sum, p) => sum + p.priceDiffPct, 0) / prices.length
    : 0

  function formatGap(diff: number, pct: number) {
    const sign   = diff >= 0 ? '+' : ''
    const color  = diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-400'
    const amount = new Intl.NumberFormat('uz-UZ').format(Math.abs(Math.round(diff)))
    return (
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {sign}{diff < 0 ? '-' : ''}{amount} ({Math.abs(pct).toFixed(1)}%)
      </span>
    )
  }

  function formatLastChecked(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) +
      ' ' + d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all',          label: 'Barchasi' },
    { key: 'lowest',       label: 'Eng arzon' },
    { key: 'competitive',  label: 'Raqobatbardosh' },
    { key: 'high-highest', label: 'Qimmat' },
  ]

  const exportData = prices.map(p => ({
    'Mahsulot':             p.productTitle,
    "Mening narxim (so'm)": p.myPrice,
    "Min raqobatchi (so'm)": p.minCompetitorPrice,
    "O'rt. raqobatchi (so'm)": p.avgCompetitorPrice,
    "Narx farqi (so'm)":    p.priceDiff,
    'Farq (%)':             p.priceDiffPct.toFixed(1),
    'Pozitsiya':            positionLabel(p.pricePosition),
    'Raqobatchilar':        p.competitorCount,
  }))

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">Kuzatilayotgan mahsulotlar</p>
          <p className="text-white text-2xl font-bold">{prices.length}</p>
        </div>
        <div className="bg-[#13131f] border border-emerald-500/20 rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">Eng arzon narx</p>
          <p className="text-emerald-400 text-2xl font-bold">{lowestCount}</p>
          <p className="text-slate-500 text-xs mt-0.5">mahsulot</p>
        </div>
        <div className="bg-[#13131f] border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">Qimmat / Eng qimmat</p>
          <p className="text-red-400 text-2xl font-bold">{highCount}</p>
          <p className="text-slate-500 text-xs mt-0.5">mahsulot</p>
        </div>
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">O&apos;rtacha narx farqi</p>
          <p className={`text-2xl font-bold ${avgGapPct > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {avgGapPct > 0 ? '+' : ''}{avgGapPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filter tabs + Export */}
      <div className="flex gap-2 flex-wrap items-center">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-violet-600 text-white'
                : 'bg-[#13131f] border border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <ExportButton data={exportData} filename="narx-kuzatuvi" targetRef={printRef} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
          <TrendingDown className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm flex-1">Raqobat narxlari</h2>
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {[
                  'Mahsulot', 'Mening narxim', 'Min raqobatchi',
                  'O\'rt. bozor', 'Farq', 'Pozitsiya',
                  'Raqobatchilar', 'So\'nggi tekshiruv',
                ].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map(item => {
                const isExpanded = expandedId === item.id
                return (
                  <>
                    <tr
                      key={item.id}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-white text-sm font-medium">{item.productTitle}</p>
                          <p className="text-slate-500 text-xs font-mono mt-0.5">{item.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-white text-sm font-semibold tabular-nums whitespace-nowrap">
                        {fs(item.myPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-300 text-sm tabular-nums whitespace-nowrap">
                        {fs(item.minCompetitorPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-sm tabular-nums whitespace-nowrap">
                        {fs(item.avgCompetitorPrice)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {formatGap(item.priceDiff, item.priceDiffPct)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${positionBg(item.pricePosition)}`}>
                          {positionLabel(item.pricePosition)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-sm text-center">
                        {item.competitorCount}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {formatLastChecked(item.lastChecked)}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${item.id}-chart`} className="bg-white/[0.015]">
                        <td colSpan={8} className="px-6 py-5">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingDown className="w-4 h-4 text-violet-400" />
                            <span className="text-white text-sm font-semibold">Narx dinamikasi — {item.productTitle}</span>
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={item.history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                              <XAxis
                                dataKey="date"
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={v => (v / 1000).toFixed(0) + 'K'}
                                width={48}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--bg-input)',
                                  border: '1px solid var(--border2)',
                                  borderRadius: '12px',
                                  fontSize: 12,
                                  color: 'var(--text-base)',
                                }}
                                formatter={(value, name) => [
                                  fs(Number(value)),
                                  name === 'myPrice' ? 'Mening narxim' : 'Min raqobatchi',
                                ]}
                              />
                              <Legend
                                formatter={(value) =>
                                  value === 'myPrice' ? 'Mening narxim' : 'Min raqobatchi'
                                }
                                wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                              />
                              <Line
                                type="monotone"
                                dataKey="myPrice"
                                stroke="#7c3aed"
                                strokeWidth={2}
                                dot={{ fill: '#7c3aed', r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="minPrice"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={{ fill: '#ef4444', r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-slate-500 text-sm">Bu filtrdagi mahsulotlar topilmadi</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-[#13131f] border border-violet-500/20 rounded-2xl px-5 py-4">
        <AlertTriangle className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-400 text-sm">
          Ma&apos;lumotlar har 6 soatda yangilanadi. Uzum API orqali real narxlar sinxronlanadi.
        </p>
      </div>
    </div>
  )
}
