'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ExportButton from './ExportButton'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Product } from '@/lib/types'
import { productAds } from '@/lib/mock-data'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

type TabKey = 'all' | 'high_drr' | 'low_stock' | 'no_orders'

function drrBadge(drr: number) {
  if (drr < 10) return { bgColor: 'rgba(52, 211, 153, 0.1)', color: '#10b981', label: `${drr.toFixed(1)}%` }
  if (drr < 20) return { bgColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', label: `${drr.toFixed(1)}%` }
  return           { bgColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',       label: `${drr.toFixed(1)}%` }
}

function stockBadge(qty: number) {
  if (qty >= 30) return { bgColor: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-dim)' }
  if (qty >= 10) return { bgColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
  return           { bgColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',       label: d.status.all          },
    { key: 'high_drr',  label: '⚠️ ' + d.highMargin  },
    { key: 'low_stock', label: '📦 ' + d.stockQty    },
    { key: 'no_orders', label: '🚫 ' + d.noMovement  },
  ]

  const allLabel = d.status.all

  const [query,    setQuery]    = useState('')
  const [sortBy,   setSortBy]   = useState<'title' | 'profit' | 'margin' | 'stock_quantity' | 'drr'>('profit')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')
  const [tab,      setTab]      = useState<TabKey>('all')
  const [drrThreshold, setDrrThreshold] = useState(20)
  const [stockThreshold, setStockThreshold] = useState(10)

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return [allLabel, ...cats]
  }, [products, allLabel])
  const [category, setCategory] = useState(allLabel)

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
    if (category !== allLabel) rows = rows.filter(p => p.category === category)

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
    [d.product]:       p.title,
    'SKU':             p.sku ?? '',
    [d.category]:      p.category ?? '',
    [d.price]:         p.selling_price ?? 0,
    [d.costPriceLabel]:p.cost_price ?? 0,
    [d.profit]:        p.profit,
    [`${d.margin} (%)`]: (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1),
    [d.sold]:          p.sold ?? 0,
    [d.stockQty]:      p.stock_quantity,
    [d.adSpendLabel]:  p.adSpend,
    'DRR (%)':         p.drr.toFixed(1),
  }))

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="ml-1" style={{ color: 'var(--text-muted)' }}>↕</span>
    return <span className="ml-1" style={{ color: '#7c3aed' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
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
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
            style={tab === key ? {
              background: 'rgba(124, 58, 237, 0.2)',
              color: '#a78bfa',
              borderColor: 'rgba(124, 58, 237, 0.3)',
            } : {
              color: 'var(--text-muted)',
              borderColor: 'transparent',
            }}>
            {label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={tab === key ? {
              background: 'rgba(124, 58, 237, 0.2)',
              color: '#7c3aed',
            } : {
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-muted)',
            }}>{tabCounts[key]}</span>
          </button>
        ))}
      </div>

      {/* Threshold controls (shown when tab active) */}
      {(tab === 'high_drr' || tab === 'low_stock') && (
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {tab === 'high_drr' && (
            <label className="flex items-center gap-2">
              DRR chegarasi:
              <input type="number" min={5} max={100} value={drrThreshold}
                onChange={e => setDrrThreshold(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded-lg focus:outline-none transition-all" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)', border: '1px solid var(--border)' }} />
              %
            </label>
          )}
          {tab === 'low_stock' && (
            <label className="flex items-center gap-2">
              Zaxira chegarasi:
              <input type="number" min={1} max={200} value={stockThreshold}
                onChange={e => setStockThreshold(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded-lg focus:outline-none transition-all" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)', border: '1px solid var(--border)' }} />
              dona
            </label>
          )}
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`${d.product}, SKU, ${d.category}...`}
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)', border: '1px solid var(--border)', '--placeholder-color': 'var(--text-muted)' } as React.CSSProperties}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all border"
              style={category === c ? {
                background: 'rgba(124, 58, 237, 0.2)',
                color: '#a78bfa',
                borderColor: 'rgba(124, 58, 237, 0.3)',
              } : {
                color: 'var(--text-muted)',
                borderColor: 'var(--border)',
              }}>
              {c}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <ExportButton data={exportData} filename="mahsulotlar" />
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} {d.productCount} {query || category !== allLabel ? '(filtr)' : ''}</p>

      <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
                <th className="text-left font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('title')}>
                  {d.product} <SortIcon col="title" />
                </th>
                <th className="text-left font-medium px-5 py-3">{d.category}</th>
                <th className="text-right font-medium px-5 py-3">{d.price}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('profit')}>
                  {d.profit} <SortIcon col="profit" />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('margin')}>
                  {d.margin} <SortIcon col="margin" />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('drr')}>
                  DRR <SortIcon col="drr" />
                </th>
                <th className="text-right font-medium px-5 py-3">{d.sold}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('stock_quantity')}>
                  {d.stockQty} <SortIcon col="stock_quantity" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{d.noProductsTitle}</td></tr>
              ) : filtered.map((p, idx) => {
                const price  = Number(p.selling_price ?? 0)
                const margin = price > 0 ? Number(((p.profit / price) * 100).toFixed(1)) : 0
                const drr = drrBadge(p.drr)
                const stock = stockBadge(p.stock_quantity)
                const noSaleWithAd = (p.sold ?? 0) === 0 && p.adSpend > 0
                const organicSale  = (p.sold ?? 0) > 0 && p.adSpend === 0
                const marginColor = margin > 35 ? '#10b981' : margin > 20 ? '#f59e0b' : '#ef4444'
                return (
                  <tr key={p.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium transition-colors" style={{ color: 'var(--text-base)' }}>{p.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.sku}</p>
                        </div>
                        {/* Smart indicators */}
                        {noSaleWithAd && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} title="Reklama sarfi bor, lekin sotuv yo'q" />
                        )}
                        {organicSale && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10b981' }} title="Reklamasiz organik sotuv" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2.5 py-1 rounded-lg border" style={{ color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border)' }}>{p.category ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(price)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-semibold" style={{ color: '#10b981' }}>{fmt(p.profit)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(margin, 100)}%`, background: 'linear-gradient(to right, #7c3aed, #10b981)' }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: marginColor }}>
                          {margin}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg" style={{ background: drr.bgColor, color: drr.color }}>
                        {drr.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>{p.sold ?? 0}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: stock.bgColor, color: stock.color }}>
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
      <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />Reklama bor, sotuv yo&apos;q</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />Reklamasiz organik sotuv</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded border" style={{ background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.2)' }} /><span style={{ color: '#10b981' }}>DRR &lt;10%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded border" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }} /><span style={{ color: '#f59e0b' }}>DRR 10–20%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded border" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }} /><span style={{ color: '#ef4444' }}>DRR &gt;20%</span></span>
      </div>
    </div>
  )
}
