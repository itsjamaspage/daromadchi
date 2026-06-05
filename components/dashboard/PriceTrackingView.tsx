'use client'

import { useState, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { CompetitorPrice } from '@/lib/types'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

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

function positionLabel(p: CompetitorPrice['pricePosition'], t: { posLowest: string; posCompetitive: string; posHigh: string; posHighest: string }) {
  switch (p) {
    case 'lowest':      return t.posLowest
    case 'competitive': return t.posCompetitive
    case 'high':        return t.posHigh
    case 'highest':     return t.posHighest
  }
}

type Filter = 'all' | 'lowest' | 'competitive' | 'high-highest'

export default function PriceTrackingView({ prices }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].priceTracking
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
    const color  = diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'
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
    { key: 'all',          label: t.tabAll         },
    { key: 'lowest',       label: t.tabLowest       },
    { key: 'competitive',  label: t.tabCompetitive  },
    { key: 'high-highest', label: t.tabHigh         },
  ]

  const exportData = prices.map(p => ({
    [t.colProduct]:                    p.productTitle,
    [`${t.colMyPrice} (so'm)`]:        p.myPrice,
    [`${t.colMinComp} (so'm)`]:        p.minCompetitorPrice,
    [`${t.colAvgMarket} (so'm)`]:      p.avgCompetitorPrice,
    [`${t.colGap} (so'm)`]:            p.priceDiff,
    [`${t.colGap} (%)`]:               p.priceDiffPct.toFixed(1),
    [t.colPosition]:                   positionLabel(p.pricePosition, t),
    [t.colCompetitors]:                p.competitorCount,
  }))

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">Kuzatilayotgan mahsulotlar</p>
          <p className="text-[var(--text-base)] text-2xl font-bold">{prices.length}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-emerald-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">Eng arzon narx</p>
          <p className="text-emerald-400 text-2xl font-bold">{lowestCount}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">mahsulot</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">Qimmat / Eng qimmat</p>
          <p className="text-red-400 text-2xl font-bold">{highCount}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">mahsulot</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">O&apos;rtacha narx farqi</p>
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
                ? 'bg-violet-600 text-[var(--text-base)]'
                : 'bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-base)] hover:border-[var(--border)]'
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
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <TrendingDown className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm flex-1">Raqobat narxlari</h2>
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[
                  t.colProduct, t.colMyPrice, t.colMinComp,
                  t.colAvgMarket, t.colGap, t.colPosition,
                  t.colCompetitors, t.colLastCheck,
                ].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(item => {
                const isExpanded = expandedId === item.id
                return (
                  <>
                    <tr
                      key={item.id}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="hover:bg-[var(--bg-card2)] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-[var(--text-base)] text-sm font-medium">{item.productTitle}</p>
                          <p className="text-[var(--text-muted)] text-xs font-mono mt-0.5">{item.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-base)] text-sm font-semibold tabular-nums whitespace-nowrap">
                        {fs(item.myPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-dim)] text-sm tabular-nums whitespace-nowrap">
                        {fs(item.minCompetitorPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)] text-sm tabular-nums whitespace-nowrap">
                        {fs(item.avgCompetitorPrice)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {formatGap(item.priceDiff, item.priceDiffPct)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${positionBg(item.pricePosition)}`}>
                          {positionLabel(item.pricePosition, t)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)] text-sm text-center">
                        {item.competitorCount}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs whitespace-nowrap">
                        {formatLastChecked(item.lastChecked)}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${item.id}-chart`} className="bg-[var(--bg-card2)]">
                        <td colSpan={8} className="px-6 py-5">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingDown className="w-4 h-4 text-violet-400" />
                            <span className="text-[var(--text-base)] text-sm font-semibold">Narx dinamikasi — {item.productTitle}</span>
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
                                  name === 'myPrice' ? t.myPrice : t.minComp,
                                ]}
                              />
                              <Legend
                                formatter={(value) =>
                                  value === 'myPrice' ? t.myPrice : t.minComp
                                }
                                wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}
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
                    <p className="text-[var(--text-muted)] text-sm">Bu filtrdagi mahsulotlar topilmadi</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-[var(--bg-card2)] border border-violet-500/20 rounded-2xl px-5 py-4">
        <AlertTriangle className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-[var(--text-muted)] text-sm">
          Ma&apos;lumotlar kuniga bir marta yangilanadi. Uzum API orqali real narxlar sinxronlanadi.
        </p>
      </div>
    </div>
  )
}
