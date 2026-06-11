'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { SearchPhrase } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}
function fmtSom(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

type Tab = 'all' | 'withOrders' | 'noOrders'

interface ProductGroup {
  productId: string
  productTitle: string
  keywords: string[]
  impressions: number
  clicks: number
  ctr: number
  orders: number
  spend: number
}

interface Props { phrases: SearchPhrase[] }

export default function KeywordsView({ phrases }: Props) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('all')

  // Group phrase-level rows into per-product keyword groups
  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>()
    for (const p of phrases) {
      const key = p.productId || p.productTitle || p.id
      const ex = map.get(key) ?? {
        productId: key,
        productTitle: p.productTitle || '—',
        keywords: [],
        impressions: 0,
        clicks: 0,
        ctr: 0,
        orders: 0,
        spend: 0,
      }
      if (p.phrase && !ex.keywords.includes(p.phrase)) ex.keywords.push(p.phrase)
      ex.impressions += p.impressions
      ex.clicks += p.clicks
      ex.orders += p.orders
      ex.spend += p.spend
      map.set(key, ex)
    }
    const arr = [...map.values()]
    for (const g of arr) g.ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0
    return arr.sort((a, b) => b.impressions - a.impressions)
  }, [phrases])

  const filtered = useMemo(() => {
    let rows = groups
    if (activeTab === 'withOrders') rows = rows.filter(r => r.orders > 0)
    if (activeTab === 'noOrders')   rows = rows.filter(r => r.orders === 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.productTitle.toLowerCase().includes(q) ||
        r.keywords.some(k => k.toLowerCase().includes(q)),
      )
    }
    return rows
  }, [groups, search, activeTab])

  const totalImpressions = groups.reduce((s, r) => s + r.impressions, 0)
  const totalClicks      = groups.reduce((s, r) => s + r.clicks, 0)
  const avgCtr           = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const withOrders       = groups.filter(r => r.orders > 0).length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',        label: d.kwTabAll },
    { key: 'withOrders', label: d.kwTabWithOrders },
    { key: 'noOrders',   label: d.kwTabNoOrders },
  ]

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: d.kwTotalImpressions, value: fmt(totalImpressions) },
          { label: d.kwTotalClicks,      value: fmt(totalClicks) },
          { label: d.kwAvgCtr,           value: avgCtr.toFixed(2) + '%' },
          { label: d.kwWithOrders,       value: String(withOrders) },
        ].map(c => (
          <div key={c.label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
            <p className="font-bold text-lg text-[var(--text-base)]">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + table */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={d.kwSearchPlaceholder}
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl w-fit">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === t.key
                    ? 'bg-violet-600/20 text-violet-700 border border-violet-500/30 dark:text-violet-300'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left font-medium px-5 py-3">{d.kwColProduct}</th>
                <th className="text-left font-medium px-4 py-3">{d.kwColKeywords}</th>
                <th className="text-right font-medium px-4 py-3">{d.kwColImpressions}</th>
                <th className="text-right font-medium px-4 py-3">{d.kwColClicks}</th>
                <th className="text-right font-medium px-4 py-3">{d.kwColCtr}</th>
                <th className="text-right font-medium px-4 py-3">{d.kwColOrders}</th>
                <th className="text-right font-medium px-4 py-3">{d.kwColSpend}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[var(--text-muted)] text-sm">
                    {d.kwNoResults}
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.productId} className="hover:bg-[var(--bg-card2)] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-[var(--text-base)] font-medium text-xs">{row.productTitle}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {row.keywords.slice(0, 5).map(kw => (
                        <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-xs font-medium">{fmt(row.impressions)}</td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-xs font-medium">{fmt(row.clicks)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-xs font-bold ${
                      row.ctr >= 4 ? 'text-emerald-400' : row.ctr >= 2 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {row.ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-xs font-medium">{fmt(row.orders)}</td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-muted)] text-xs">{fmtSom(row.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            {filtered.length} {d.kwShowing}
          </div>
        )}
      </div>
    </div>
  )
}
