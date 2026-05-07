'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ExportButton from './ExportButton'
import type { Product } from '@/lib/types'
import { productAds } from '@/lib/mock-data'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

type TabKey = 'all' | 'high_drr' | 'low_stock' | 'no_orders'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',       label: 'Hammasi'        },
  { key: 'high_drr',  label: '⚠️ Yuqori DRR'  },
  { key: 'low_stock', label: '📦 Kam zaxira'  },
  { key: 'no_orders', label: '🚫 Sotuvsiz'    },
]

function drrBadge(drr: number) {
  if (drr < 10) return { bg: 'bg-emerald-500/10 text-emerald-400', label: `${drr.toFixed(1)}%` }
  if (drr < 20) return { bg: 'bg-amber-500/10 text-amber-400',     label: `${drr.toFixed(1)}%` }
  return           { bg: 'bg-red-500/10 text-red-400',             label: `${drr.toFixed(1)}%` }
}

function stockBadge(qty: number) {
  if (qty >= 30) return { bg: 'bg-slate-700/40 text-slate-300'    }
  if (qty >= 10) return { bg: 'bg-amber-500/10 text-amber-400'    }
  return           { bg: 'bg-red-500/10 text-red-400'            }
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const [query,    setQuery]    = useState('')
  const [sortBy,   setSortBy]   = useState<'title' | 'profit' | 'margin' | 'stock_quantity' | 'drr'>('profit')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')
  const [tab,      setTab]      = useState<TabKey>('all')
  const [drrThreshold, setDrrThreshold] = useState(20)
  const [stockThreshold, setStockThreshold] = useState(10)

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return ['Barchasi', ...cats]
  }, [products])
  const [category, setCategory] = useState('Barchasi')

  // Enrich products with ad data + DRR
  const enriched = useMemo(() => products.map((p, idx) => {
    const adKey = (idx + 1) as keyof typeof productAds
    const ad = productAds[adKey] || { adSpend: 0, clicks: 0, adOrders: 0 }
    const revenue = Number(p.selling_price ?? 0) * (p.sold ?? 0)
    const drr = revenue > 0 ? (ad.adSpend / revenue) * 100 : 0
    return { ...p, adSpend: ad.adSpend, adOrders: ad.adOrders, adClicks: ad.clicks, drr }
  }), [products])

  const filtered = useMemo(() => {
    let rows = [...enriched]

    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      )
    }
    if (category !== 'Barchasi') rows = rows.filter(p => p.category === category)

    // Tab filter
    if (tab === 'high_drr')  rows = rows.filter(p => p.drr >= drrThreshold)
    if (tab === 'low_stock') rows = rows.filter(p => p.stock_quantity < stockThreshold)
    if (tab === 'no_orders') rows = rows.filter(p => (p.sold ?? 0) === 0)

    rows.sort((a, b) => {
      let av: number, bv: number
      if (sortBy === 'margin') {
        av = a.profit / (Number(a.selling_price) || 1)
        bv = b.profit / (Number(b.selling_price) || 1)
      } else if (sortBy === 'drr') {
        av = a.drr; bv = b.drr
      } else {
        av = (a as Record<string, unknown>)[sortBy] as number ?? 0
        bv = (b as Record<string, unknown>)[sortBy] as number ?? 0
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [enriched, query, category, tab, sortBy, sortDir, drrThreshold, stockThreshold])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const exportData = filtered.map(p => ({
    'Mahsulot':    p.title,
    'SKU':         p.sku ?? '',
    'Kategoriya':  p.category ?? '',
    "Narx":        p.selling_price ?? 0,
    "Tannarx":     p.cost_price ?? 0,
    "Foyda":       p.profit,
    'Margin (%)':  (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1),
    'Sotilgan':    p.sold ?? 0,
    'Ombor':       p.stock_quantity,
    'Reklama':     p.adSpend,
    'DRR (%)':     p.drr.toFixed(1),
  }))

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-slate-700 ml-1">↕</span>
    return <span className="text-violet-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const tabCounts = {
    all:       enriched.length,
    high_drr:  enriched.filter(p => p.drr >= drrThreshold).length,
    low_stock: enriched.filter(p => p.stock_quantity < stockThreshold).length,
    no_orders: enriched.filter(p => (p.sold ?? 0) === 0).length,
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#13131f] border border-white/[0.06] rounded-xl w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === key
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === key ? 'bg-violet-500/20 text-violet-400' : 'bg-white/[0.04] text-slate-600'
            }`}>{tabCounts[key]}</span>
          </button>
        ))}
      </div>

      {/* Threshold controls (shown when tab active) */}
      {(tab === 'high_drr' || tab === 'low_stock') && (
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {tab === 'high_drr' && (
            <label className="flex items-center gap-2">
              DRR chegarasi:
              <input type="number" min={5} max={100} value={drrThreshold}
                onChange={e => setDrrThreshold(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-[#13131f] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-violet-500/50" />
              %
            </label>
          )}
          {tab === 'low_stock' && (
            <label className="flex items-center gap-2">
              Zaxira chegarasi:
              <input type="number" min={1} max={200} value={stockThreshold}
                onChange={e => setStockThreshold(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-[#13131f] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-violet-500/50" />
              dona
            </label>
          )}
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Mahsulot nomi, SKU yoki kategoriya..."
            className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                category === c
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                  : 'text-slate-400 border-white/[0.06] hover:text-white hover:border-white/[0.12]'
              }`}>
              {c}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <ExportButton data={exportData} filename="mahsulotlar" />
        </div>
      </div>

      <p className="text-slate-500 text-xs">{filtered.length} ta mahsulot {query || category !== 'Barchasi' ? '(filtr)' : ''}</p>

      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('title')}>
                  Mahsulot <SortIcon col="title" />
                </th>
                <th className="text-left font-medium px-5 py-3">Kategoriya</th>
                <th className="text-right font-medium px-5 py-3">Narx</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('profit')}>
                  Foyda <SortIcon col="profit" />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('margin')}>
                  Margin <SortIcon col="margin" />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('drr')}>
                  DRR <SortIcon col="drr" />
                </th>
                <th className="text-right font-medium px-5 py-3">Sotilgan</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('stock_quantity')}>
                  Ombor <SortIcon col="stock_quantity" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500 text-sm">Hech narsa topilmadi</td></tr>
              ) : filtered.map(p => {
                const price  = Number(p.selling_price ?? 0)
                const margin = price > 0 ? Number(((p.profit / price) * 100).toFixed(1)) : 0
                const drr = drrBadge(p.drr)
                const stock = stockBadge(p.stock_quantity)
                const noSaleWithAd = (p.sold ?? 0) === 0 && p.adSpend > 0
                const organicSale  = (p.sold ?? 0) > 0 && p.adSpend === 0
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-white font-medium group-hover:text-violet-300 transition-colors">{p.title}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{p.sku}</p>
                        </div>
                        {/* Smart indicators */}
                        {noSaleWithAd && (
                          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Reklama sarfi bor, lekin sotuv yo'q" />
                        )}
                        {organicSale && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Reklamasiz organik sotuv" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">{p.category ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">{fmt(price)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-emerald-400 font-semibold">{fmt(p.profit)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                            style={{ width: `${Math.min(margin, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${margin > 35 ? 'text-emerald-400' : margin > 20 ? 'text-amber-400' : 'text-red-400'}`}>
                          {margin}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${drr.bg}`}>
                        {drr.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">{p.sold ?? 0}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${stock.bg}`}>
                        {p.stock_quantity}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Indicator legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Reklama bor, sotuv yo&apos;q</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Reklamasiz organik sotuv</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded bg-emerald-500/10 border border-emerald-500/20" /><span className="text-emerald-400">DRR &lt;10%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded bg-amber-500/10 border border-amber-500/20" /><span className="text-amber-400">DRR 10–20%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded bg-red-500/10 border border-red-500/20" /><span className="text-red-400">DRR &gt;20%</span></span>
      </div>
    </div>
  )
}
