'use client'

import { useState, useMemo, useCallback, Fragment } from 'react'
import { Search, Check, X, Pencil } from 'lucide-react'
import ExportButton from './ExportButton'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Product, MarketplaceType } from '@/lib/types'
import { useRouter } from 'next/navigation'

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

type TabKey = 'all' | 'low_stock' | 'no_orders' | 'cancelled'
type SortKey = 'title' | 'profit' | 'margin' | 'stock_quantity'

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <span className="ml-1" style={{ color: 'var(--text-muted)' }}>↕</span>
  return <span className="ml-1" style={{ color: 'var(--c1)' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
}


function stockBadge(qty: number) {
  if (qty >= 30) return { bgColor: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-dim)' }
  if (qty >= 10) return { bgColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
  return           { bgColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
}

function EditRow({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: (productId: string, newCostPrice: number | null, fetchDone: Promise<void>) => void }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [costPrice, setCostPrice] = useState(product.cost_price != null ? String(product.cost_price) : '')

  const sellingPrice = Number(product.selling_price ?? 0)
  const cp = Number(costPrice) || 0
  const newProfit = sellingPrice - cp
  const newMargin = sellingPrice > 0 ? (newProfit / sellingPrice * 100) : 0

  function handleSave() {
    const newCost = costPrice === '' ? null : Number(costPrice)
    const fetchDone = fetch('/api/products/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, costPrice: newCost }),
    }).then(() => {}).catch(() => {})

    onSaved(product.id, newCost, fetchDone)
    onClose()
  }

  return (
    <tr>
      <td colSpan={9} className="px-5 py-4" style={{ background: 'var(--bg-input)' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.price}</label>
            <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
              {fmt(sellingPrice)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.costPriceLabel}</label>
            <input
              type="number"
              min={0}
              value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
              placeholder="0"
              className="px-3 py-2 rounded-lg text-sm border w-40 focus:outline-none"
              style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.profit}</label>
            <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: newProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {fmt(newProfit)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{d.margin}</label>
            <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: newMargin > 35 ? '#10b981' : newMargin > 20 ? '#f59e0b' : '#ef4444' }}>
              {newMargin.toFixed(1)}%
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-colors"
              style={{ borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-colors"
              style={{ borderColor: 'rgba(239, 68, 68, 0.5)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const router = useRouter()

  const allLabel = d.status.all

  const [mp,             setMp]             = useState<MarketplaceType | undefined>(undefined)
  const [query,          setQuery]          = useState('')
  const [sortBy,         setSortBy]         = useState<SortKey>('profit')
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('desc')
  const [tab,            setTab]            = useState<TabKey>('all')
  const [stockThreshold, setStockThreshold] = useState(10)
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, number | null>>(new Map())

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

  const productsWithOverrides = useMemo(() => products.map(p => {
    if (!optimisticUpdates.has(p.id)) return p
    const newCost = optimisticUpdates.get(p.id) ?? null
    const selling = Number(p.selling_price ?? 0)
    const profit = selling - (newCost ?? 0)
    return { ...p, cost_price: newCost, profit }
  }), [products, optimisticUpdates])

  const enriched = useMemo(() => productsWithOverrides
    .filter(p => !mp || p.marketplace === mp),
    [productsWithOverrides, mp])

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',       label: d.status.all          },
    { key: 'low_stock', label: '📦 ' + d.stockQty    },
    { key: 'no_orders', label: '🚫 ' + d.noMovement  },
    { key: 'cancelled', label: '❌ ' + d.cancelledTab },
  ]

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

    if (tab === 'low_stock') rows = rows.filter(p => p.available_stock < stockThreshold)
    if (tab === 'no_orders') rows = rows.filter(p => (p.sold ?? 0) === 0)
    if (tab === 'cancelled') rows = rows.filter(p => (p.cancelled ?? 0) > 0)

    rows.sort((a, b) => {
      let av: number, bv: number
      if (sortBy === 'margin') {
        av = a.profit / (Number(a.selling_price) || 1)
        bv = b.profit / (Number(b.selling_price) || 1)
      } else if (sortBy === 'title') {
        return sortDir === 'desc'
          ? b.title.localeCompare(a.title)
          : a.title.localeCompare(b.title)
      } else if (sortBy === 'profit') {
        av = a.profit; bv = b.profit
      } else {
        av = a.available_stock; bv = b.available_stock
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [enriched, query, category, tab, sortBy, sortDir, stockThreshold, allLabel])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const handleSaved = useCallback((productId: string, newCostPrice: number | null, fetchDone: Promise<void>) => {
    setOptimisticUpdates(prev => new Map(prev).set(productId, newCostPrice))
    fetchDone.then(() => router.refresh())
  }, [router])

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
  }))

  const tabCounts = {
    all:       enriched.length,
    low_stock: enriched.filter(p => p.available_stock < stockThreshold).length,
    no_orders: enriched.filter(p => (p.sold ?? 0) === 0).length,
    cancelled: enriched.filter(p => (p.cancelled ?? 0) > 0).length,
  }

  return (
    <div className="space-y-4">
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

      {tab === 'low_stock' && (
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
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
                <th className="text-right font-medium px-5 py-3">{d.costPrice}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('profit')}>
                  {d.profit} <SortIcon col="profit" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('margin')}>
                  {d.margin} <SortIcon col="margin" sortBy={sortBy} sortDir={sortDir} />
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
                const stock = stockBadge(p.available_stock)
                const marginColor  = margin > 35 ? '#10b981' : margin > 20 ? '#f59e0b' : '#ef4444'
                const isEditing = editingId === p.id
                return (
                  <Fragment key={p.id}>
                    <tr style={{ borderBottom: (!isEditing && idx < filtered.length - 1) ? '1px solid var(--border)' : isEditing ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                      onClick={() => setEditingId(isEditing ? null : p.id)}>
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
                          <Pencil className="w-3.5 h-3.5 flex-shrink-0 opacity-30" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2.5 py-1 rounded-lg border" style={{ color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border)' }}>{p.category ?? '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(price)}</td>
                      <td className="px-5 py-4 text-right" style={{ color: p.cost_price ? 'var(--text-dim)' : 'var(--text-muted)' }}>
                        {p.cost_price ? fmt(p.cost_price) : '—'}
                      </td>
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
                      <td className="px-5 py-4 text-right" style={{ color: 'var(--text-dim)' }}>
                        {p.sold ?? 0}
                        {(p.cancelled ?? 0) > 0 && (
                          <span className="ml-1.5 text-[11px] font-medium tabular-nums" style={{ color: '#ef4444' }} title={d.cancelledUnits}>
                            (−{p.cancelled})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: stock.bgColor, color: stock.color }}>
                          {p.available_stock}
                        </span>
                      </td>
                    </tr>
                    {isEditing && (
                      <EditRow
                        product={p}
                        onClose={() => setEditingId(null)}
                        onSaved={handleSaved}
                      />
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
