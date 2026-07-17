'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ExportButton from './ExportButton'
import { useLang, useTheme } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Product, MarketplaceType } from '@/lib/types'

const MP_META: Record<MarketplaceType, { label: string; short: string; color: string; bg: string }> = {
  uzum:          { label: 'Uzum',          short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { label: 'Yandex Market', short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
  wildberries:   { label: 'Wildberries',   short: 'WB', color: '#CB11AB', bg: 'rgba(203,17,171,0.12)' },
}

function MpBadge({ mp }: { mp: MarketplaceType }) {
  const m = MP_META[mp]
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ background: m.bg, color: m.color }}
    >
      {m.short}
    </span>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

type TabKey = 'all' | 'high_drr' | 'low_stock' | 'no_orders'
type SortKey = 'title' | 'profit' | 'margin' | 'stock_quantity' | 'drr'

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <span className="ml-1" style={{ color: 'var(--text-muted)' }}>↕</span>
  return <span className="ml-1" style={{ color: 'var(--c1)' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
}

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const d = translations[lang].dashboard

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',       label: d.status.all          },
    { key: 'high_drr',  label: '⚠️ ' + d.highMargin  },
    { key: 'low_stock', label: '📦 ' + d.stockQty    },
    { key: 'no_orders', label: '🚫 ' + d.noMovement  },
  ]

  const allLabel = d.status.all

  const [mp,             setMp]             = useState<MarketplaceType | undefined>(undefined)
  const [query,          setQuery]          = useState('')
  const [sortBy,         setSortBy]         = useState<SortKey>('profit')
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('desc')
  const [tab,            setTab]            = useState<TabKey>('all')
  const [drrThreshold,   setDrrThreshold]   = useState(20)
  const [stockThreshold, setStockThreshold] = useState(10)

  // Derive available marketplaces from the product list (only show tabs for connected ones)
  const availableMps = useMemo(() => {
    const mps = new Set<MarketplaceType>()
    for (const p of products) if (p.marketplace) mps.add(p.marketplace)
    return [...mps].sort()
  }, [products])

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return [allLabel, ...cats]
  }, [products, allLabel])
  const [category, setCategory] = useState(allLabel)

  // Ad metrics come from real ad-sync data; until connected they are 0.
  const enriched = useMemo(() => products
    .filter(p => !mp || p.marketplace === mp)
    .map((p) => ({
      ...p, adSpend: 0, adOrders: 0, adClicks: 0, drr: 0,
    })), [products, mp])

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

    if (tab === 'high_drr')  rows = rows.filter(p => p.drr >= drrThreshold)
    if (tab === 'low_stock') rows = rows.filter(p => p.available_stock < stockThreshold)
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
  }, [enriched, query, category, tab, sortBy, sortDir, drrThreshold, stockThreshold, allLabel])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const exportData = filtered.map(p => ({
    [d.product]:          p.title,
    'SKU':                p.sku ?? '',
    'Marketplace':        p.marketplace ? MP_META[p.marketplace]?.label : '',
    [d.category]:         p.category ?? '',
    [d.price]:            p.selling_price ?? 0,
    [d.costPriceLabel]:   p.cost_price ?? 0,
    [d.profit]:           p.profit,
    [`${d.margin} (%)`]:  (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1),
    [d.sold]:             p.sold ?? 0,
    [d.stockQty]:         p.available_stock,
    [d.adSpendLabel]:     p.adSpend,
    'DRR (%)':            p.drr.toFixed(1),
  }))

  const tabCounts = {
    all:       enriched.length,
    high_drr:  enriched.filter(p => p.drr >= drrThreshold).length,
    low_stock: enriched.filter(p => p.available_stock < stockThreshold).length,
    no_orders: enriched.filter(p => (p.sold ?? 0) === 0).length,
  }

  return (
    <div className="space-y-4">
      {/* Marketplace tabs — instant client-side filter, only shows connected marketplaces */}
      {availableMps.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <button
            onClick={() => setMp(undefined)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={mp === undefined ? {
              background: 'var(--bg-card2)',
              color: 'var(--c1)',
              border: '1px solid var(--border)',
            } : {
              color: 'var(--text-muted)',
              border: '1px solid transparent',
            }}
          >
            {d.all ?? 'Barchasi'}
          </button>
          {availableMps.map(m => (
            <button
              key={m}
              onClick={() => setMp(m)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={mp === m ? {
                background: MP_META[m].bg,
                color: MP_META[m].color,
                border: `1px solid ${MP_META[m].color}40`,
              } : {
                color: 'var(--text-muted)',
                border: '1px solid transparent',
              }}
            >
              {MP_META[m].label}
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
            style={tab === key ? {
              background: 'var(--bg-card2)',
              color: 'var(--c1)',
               borderColor: 'var(--border)',
            } : {
              color: 'var(--text-muted)',
              borderColor: 'transparent',
            }}>
            {label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={tab === key ? {
              background: 'var(--bg-card2)',
              color: 'var(--c1)',
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
                background: 'var(--bg-card2)',
                color: 'var(--c1)',
                 borderColor: 'var(--border)',
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
                  {d.product} <SortIcon col="title" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-left font-medium px-5 py-3">{d.category}</th>
                <th className="text-right font-medium px-5 py-3">{d.price}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('profit')}>
                  {d.profit} <SortIcon col="profit" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('margin')}>
                  {d.margin} <SortIcon col="margin" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('drr')}>
                  DRR <SortIcon col="drr" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3">{d.sold}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('stock_quantity')}>
                  {d.stockQty} <SortIcon col="stock_quantity" sortBy={sortBy} sortDir={sortDir} />
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
                const stock = stockBadge(p.available_stock)
                const noSaleWithAd = (p.sold ?? 0) === 0 && p.adSpend > 0
                const organicSale  = (p.sold ?? 0) > 0 && p.adSpend === 0
                const marginColor  = margin > 35 ? '#10b981' : margin > 20 ? '#f59e0b' : '#ef4444'
                return (
                  <tr key={p.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-base)' }}>{p.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
                            {p.marketplace && <MpBadge mp={p.marketplace} />}
                            {p.is_shared && (
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
                                title="Bu SKU bir nechta do'kon o'rtasida bo'linadi"
                              >
                                Umumiy
                              </span>
                            )}
                          </div>
                        </div>
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
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium tabular-nums" style={{ color: marginColor }}>{margin}%</span>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(margin, 100)}%`, background: 'linear-gradient(to right, var(--c1), #428619)' }} />
                        </div>
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
                        {p.available_stock}
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
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: isDark ? '#ef4444' : '#dc2626' }} />Reklama bor, sotuv yo&apos;q</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: isDark ? '#10b981' : '#047857' }} />Reklamasiz organik sotuv</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded border" style={{ background: isDark ? 'rgba(52, 211, 153, 0.1)' : '#d1fae5', borderColor: isDark ? 'rgba(52, 211, 153, 0.2)' : '#059669' }} /><span style={{ color: isDark ? '#10b981' : '#065f46', fontWeight: isDark ? 400 : 600 }}>DRR &lt;10%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded border" style={{ background: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fef3c7', borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#d97706' }} /><span style={{ color: isDark ? '#f59e0b' : '#92400e', fontWeight: isDark ? 400 : 600 }}>DRR 10–20%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded border" style={{ background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#dc2626' }} /><span style={{ color: isDark ? '#ef4444' : '#991b1b', fontWeight: isDark ? 400 : 600 }}>DRR &gt;20%</span></span>
      </div>
    </div>
  )
}
