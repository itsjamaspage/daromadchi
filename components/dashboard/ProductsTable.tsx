'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Link2, Pencil, Check, X, SlidersHorizontal, Gauge } from 'lucide-react'
import ExportButton from './ExportButton'
import type { Product, AdsStatsSummary } from '@/lib/types'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}
function fmtNum(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

const ALL = 'Barchasi'
const LS_HIDDEN_COLS    = 'products-hidden-cols'
const LS_THRESHOLDS     = 'products-thresholds'

interface Thresholds {
  drrGreen:    number   // DRR ≤ this → green
  drrYellow:   number   // DRR ≤ this → yellow, above → red
  stockYellow: number   // stock ≤ this → yellow
  stockRed:    number   // stock ≤ this → red
}
const DEFAULT_THRESHOLDS: Thresholds = { drrGreen: 10, drrYellow: 20, stockYellow: 30, stockRed: 10 }

type QuickFilter = 'all' | 'low-stock' | 'out-of-stock' | 'no-orders' | 'high-margin' | 'high-drr' | 'with-ads'

const TOGGLEABLE_COLS = ['category', 'price', 'cost', 'profit', 'margin', 'sold', 'stock', 'drr', 'adSpend', 'impressions', 'clicks', 'ctr'] as const
type ColId = typeof TOGGLEABLE_COLS[number]

function StockCell({ product, onUpdated, stockColorClass }: {
  product: Product
  onUpdated: (sku: string, val: number | null) => void
  stockColorClass?: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(product.physical_stock ?? ''))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const stockLow = product.available_stock < 20
  const colorClass = stockColorClass ?? (stockLow ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/40 text-slate-300')

  async function save() {
    if (!product.sku) return
    setSaving(true)
    const parsed = value.trim() === '' ? null : parseInt(value, 10)
    await fetch('/api/products/physical-stock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: product.sku, physical_stock: parsed }),
    })
    onUpdated(product.sku, parsed)
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setValue(String(product.physical_stock ?? ''))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-20 bg-[var(--bg-input)] border border-violet-500/50 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-violet-500/60"
          autoFocus
          disabled={saving}
        />
        <button onClick={save} disabled={saving} className="text-emerald-400 hover:text-emerald-300 p-0.5"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="text-slate-500 hover:text-slate-300 p-0.5"><X className="w-3.5 h-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5 group/stock">
      <div className="text-right">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${colorClass}`}>
          {product.available_stock}
        </span>
        {product.is_shared && product.sku && (
          <p className="text-[10px] text-violet-400/70 mt-0.5 flex items-center justify-end gap-0.5">
            <Link2 className="w-2.5 h-2.5" />
            {product.physical_stock} total
          </p>
        )}
      </div>
      {product.sku && (
        <button
          onClick={() => { setValue(String(product.physical_stock ?? '')); setEditing(true) }}
          className="opacity-0 group-hover/stock:opacity-100 text-slate-600 hover:text-violet-400 transition-all p-0.5"
          title="Set total physical stock"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

export default function ProductsTable({ products: initialProducts, adsStats }: {
  products: Product[]
  adsStats?: Record<string, AdsStatsSummary>
}) {
  const { lang } = useLang()
  const t = dashT[lang].products
  const [products, setProducts] = useState(initialProducts)
  const [query,       setQuery]       = useState('')
  const [sortBy,      setSortBy]      = useState<'title' | 'profit' | 'margin' | 'available_stock' | 'drr'>('profit')
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [hiddenCols,  setHiddenCols]  = useState<Set<ColId>>(new Set())
  const [showColPanel,    setShowColPanel]    = useState(false)
  const [showIndicators,  setShowIndicators]  = useState(false)
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const colPanelRef = useRef<HTMLDivElement>(null)
  const indPanelRef = useRef<HTMLDivElement>(null)

  const hasAds = !!adsStats && Object.keys(adsStats).length > 0

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedCols = localStorage.getItem(LS_HIDDEN_COLS)
      if (savedCols) setHiddenCols(new Set(JSON.parse(savedCols) as ColId[]))
      const savedThr = localStorage.getItem(LS_THRESHOLDS)
      if (savedThr) setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(savedThr) })
    } catch { /* ignore */ }
  }, [])

  function saveThresholds(next: Thresholds) {
    setThresholds(next)
    try { localStorage.setItem(LS_THRESHOLDS, JSON.stringify(next)) } catch { /* ignore */ }
  }

  // Close panels on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPanelRef.current && !colPanelRef.current.contains(e.target as Node)) setShowColPanel(false)
      if (indPanelRef.current && !indPanelRef.current.contains(e.target as Node)) setShowIndicators(false)
    }
    if (showColPanel || showIndicators) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColPanel, showIndicators])

  function toggleCol(id: ColId) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(LS_HIDDEN_COLS, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function applyPreset(preset: 'default' | 'compact') {
    const next: Set<ColId> = preset === 'compact'
      ? new Set(['cost', 'margin', 'sold'] as ColId[])
      : new Set()
    setHiddenCols(next)
    try { localStorage.setItem(LS_HIDDEN_COLS, JSON.stringify([...next])) } catch { /* ignore */ }
  }

  const show = (id: ColId) => !hiddenCols.has(id)

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return [ALL, ...cats]
  }, [products])
  const [category, setCategory] = useState(ALL)

  function handleStockUpdated(sku: string, physical_stock: number | null) {
    setProducts(prev => {
      const skuSold = prev
        .filter(p => p.sku === sku)
        .reduce((sum, p) => sum + (p.sold ?? 0), 0)
      return prev.map(p => {
        if (p.sku !== sku) return p
        const available_stock = physical_stock !== null
          ? Math.max(0, physical_stock - skuSold)
          : p.stock_quantity
        return { ...p, physical_stock, available_stock, is_shared: physical_stock !== null }
      })
    })
  }

  const filtered = useMemo(() => {
    let rows = [...products]
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      )
    }
    if (category !== ALL) rows = rows.filter(p => p.category === category)

    // Quick filters
    if (quickFilter === 'low-stock')   rows = rows.filter(p => p.available_stock > 0 && p.available_stock < thresholds.stockRed)
    if (quickFilter === 'out-of-stock') rows = rows.filter(p => p.available_stock === 0)
    if (quickFilter === 'no-orders')   rows = rows.filter(p => p.sold === 0)
    if (quickFilter === 'high-margin') rows = rows.filter(p => {
      const price = Number(p.selling_price ?? 0)
      return price > 0 && (p.profit / price) > 0.35
    })
    if (quickFilter === 'with-ads')  rows = rows.filter(p => hasAds && p.sku && adsStats?.[p.sku])
    if (quickFilter === 'high-drr')  rows = rows.filter(p => {
      const drr = p.sku ? (adsStats?.[p.sku]?.drr ?? 0) : 0
      return drr > thresholds.drrYellow
    })

    rows.sort((a, b) => {
      const av = sortBy === 'margin'
        ? a.profit / (Number(a.selling_price) || 1)
        : sortBy === 'available_stock'
        ? a.available_stock
        : sortBy === 'drr'
        ? (a.sku ? (adsStats?.[a.sku]?.drr ?? 0) : 0)
        : (a as any)[sortBy]
      const bv = sortBy === 'margin'
        ? b.profit / (Number(b.selling_price) || 1)
        : sortBy === 'available_stock'
        ? b.available_stock
        : sortBy === 'drr'
        ? (b.sku ? (adsStats?.[b.sku]?.drr ?? 0) : 0)
        : (b as any)[sortBy]
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [products, query, category, sortBy, sortDir, quickFilter, adsStats, hasAds, thresholds])

  // Quick-filter chip counts (computed from category+text filtered, before quick filter)
  const chipCounts = useMemo(() => {
    const base = products.filter(p =>
      (!query.trim() || p.title.toLowerCase().includes(query.toLowerCase()) ||
       (p.sku ?? '').toLowerCase().includes(query.toLowerCase())) &&
      (category === ALL || p.category === category)
    )
    return {
      all:           base.length,
      'low-stock':   base.filter(p => p.available_stock > 0 && p.available_stock < thresholds.stockRed).length,
      'out-of-stock': base.filter(p => p.available_stock === 0).length,
      'no-orders':   base.filter(p => p.sold === 0).length,
      'high-margin': base.filter(p => { const pr = Number(p.selling_price ?? 0); return pr > 0 && (p.profit / pr) > 0.35 }).length,
      'with-ads':    base.filter(p => hasAds && p.sku && adsStats?.[p.sku]).length,
      'high-drr':    base.filter(p => (p.sku ? (adsStats?.[p.sku]?.drr ?? 0) : 0) > thresholds.drrYellow).length,
    }
  }, [products, query, category, adsStats, hasAds, thresholds])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const exportData = filtered.map(p => ({
    [t.colProduct]:  p.title,
    [t.colSku]:      p.sku ?? '',
    [t.colCategory]: p.category ?? '',
    [t.colPrice]:    p.selling_price ?? 0,
    [t.colCost]:     p.cost_price ?? 0,
    [t.colProfit]:   p.profit,
    [t.colMargin]:   (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1),
    [t.colSold]:     p.sold,
    [t.colStock]:    p.available_stock,
  }))

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-slate-700 ml-1">↕</span>
    return <span className="text-violet-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const colLabels: Record<ColId, string> = {
    category: t.category, price: t.price, cost: t.cost,
    profit: t.profit, margin: t.margin, sold: t.sold, stock: t.stock,
    drr: t.drr, adSpend: t.adSpend, impressions: t.impressions, clicks: t.clicks, ctr: t.ctr,
  }

  const baseChips: { id: QuickFilter; label: string }[] = [
    { id: 'all',           label: t.all },
    { id: 'low-stock',     label: t.filterLowStock },
    { id: 'out-of-stock',  label: t.filterOutOfStock },
    { id: 'no-orders',     label: t.filterNoOrders },
    { id: 'high-margin',   label: t.filterHighMargin },
  ]
  const adsChips: { id: QuickFilter; label: string }[] = hasAds ? [
    { id: 'with-ads',  label: t.filterWithAds },
    { id: 'high-drr',  label: t.filterHighDrr },
  ] : []
  const quickChips = [...baseChips, ...adsChips]

  const visibleColCount = TOGGLEABLE_COLS.filter(show).length + 1 // +1 for product name column

  return (
    <div className="space-y-4">
      {/* Search + category filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-[var(--bg-card2)] border border-[var(--border2)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                category === c
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                  : 'text-slate-400 border-[var(--border)] hover:text-white hover:border-white/[0.12]'
              }`}
            >
              {c === ALL ? t.all : c}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          {/* Threshold indicators button */}
          <div className="relative" ref={indPanelRef}>
            <button
              onClick={() => setShowIndicators(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                showIndicators
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500/30'
                  : 'text-slate-400 border-[var(--border)] hover:text-white hover:border-white/[0.12]'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              {t.indicators}
            </button>

            {showIndicators && (
              <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-5">
                <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">{t.indicators}</p>
                <p className="text-[11px] text-slate-600 mb-4">{t.indicatorsHint}</p>

                {/* DRR thresholds */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <label className="text-xs text-slate-400 flex-1">{t.drrGreen}</label>
                    <input type="number" min={0} max={100} value={thresholds.drrGreen}
                      onChange={e => saveThresholds({ ...thresholds, drrGreen: Number(e.target.value) })}
                      className="w-16 bg-[var(--bg-input)] border border-[var(--border2)] rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-violet-500/60" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <label className="text-xs text-slate-400 flex-1">{t.drrYellow}</label>
                    <input type="number" min={0} max={100} value={thresholds.drrYellow}
                      onChange={e => saveThresholds({ ...thresholds, drrYellow: Number(e.target.value) })}
                      className="w-16 bg-[var(--bg-input)] border border-[var(--border2)] rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-violet-500/60" />
                  </div>
                  <p className="text-[11px] text-slate-600 pl-6">{t.drrRedLabel} {thresholds.drrYellow}%</p>
                </div>

                <div className="border-t border-[var(--border)] pt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <label className="text-xs text-slate-400 flex-1">{t.stockYellowLabel}</label>
                    <input type="number" min={0} value={thresholds.stockYellow}
                      onChange={e => saveThresholds({ ...thresholds, stockYellow: Number(e.target.value) })}
                      className="w-16 bg-[var(--bg-input)] border border-[var(--border2)] rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-violet-500/60" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    <label className="text-xs text-slate-400 flex-1">{t.stockRedLabel}</label>
                    <input type="number" min={0} value={thresholds.stockRed}
                      onChange={e => saveThresholds({ ...thresholds, stockRed: Number(e.target.value) })}
                      className="w-16 bg-[var(--bg-input)] border border-[var(--border2)] rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-violet-500/60" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column visibility button */}
          <div className="relative" ref={colPanelRef}>
            <button
              onClick={() => setShowColPanel(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                showColPanel
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                  : 'text-slate-400 border-[var(--border)] hover:text-white hover:border-white/[0.12]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t.columns}
              {hiddenCols.size > 0 && (
                <span className="bg-violet-500/20 text-violet-300 text-[10px] px-1.5 py-0.5 rounded-md font-semibold">
                  {TOGGLEABLE_COLS.length - hiddenCols.size}/{TOGGLEABLE_COLS.length}
                </span>
              )}
            </button>

            {showColPanel && (
              <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">{t.columns}</p>
                {/* Presets */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => applyPreset('default')}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-violet-500/10 text-slate-300 hover:text-violet-300 border border-[var(--border)] transition-all"
                  >
                    {t.presetDefault}
                  </button>
                  <button
                    onClick={() => applyPreset('compact')}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-violet-500/10 text-slate-300 hover:text-violet-300 border border-[var(--border)] transition-all"
                  >
                    {t.presetCompact}
                  </button>
                </div>
                {/* Column toggles */}
                <div className="space-y-1">
                  {TOGGLEABLE_COLS.filter(id => {
                    const adsOnly: ColId[] = ['drr', 'adSpend', 'impressions', 'clicks', 'ctr']
                    return hasAds || !adsOnly.includes(id)
                  }).map(id => {
                    const adsOnly: ColId[] = ['drr', 'adSpend', 'impressions', 'clicks', 'ctr']
                    const isAds = adsOnly.includes(id)
                    return (
                      <label key={id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                        <div
                          onClick={() => toggleCol(id)}
                          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all border cursor-pointer ${
                            show(id)
                              ? isAds ? 'bg-purple-600 border-purple-500' : 'bg-violet-600 border-violet-500'
                              : 'bg-transparent border-slate-600'
                          }`}
                        >
                          {show(id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-sm text-slate-300 select-none" onClick={() => toggleCol(id)}>
                          {colLabels[id]}
                          {isAds && <span className="ml-1 text-[10px] text-purple-400/70">WB</span>}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <ExportButton data={exportData} filename={t.exportFilename} />
        </div>
      </div>

      {/* Quick filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {quickChips.map(chip => {
          const count = chipCounts[chip.id]
          const active = quickFilter === chip.id
          const hasItems = count > 0
          const isAlert = chip.id === 'low-stock' || chip.id === 'out-of-stock'
          return (
            <button
              key={chip.id}
              onClick={() => setQuickFilter(chip.id)}
              disabled={!hasItems && chip.id !== 'all'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                active
                  ? isAlert && count > 0
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                  : hasItems
                  ? 'text-slate-400 border-[var(--border)] hover:text-white hover:border-white/[0.12]'
                  : 'text-slate-700 border-slate-800/60 cursor-not-allowed'
              }`}
            >
              {chip.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                active
                  ? isAlert && count > 0
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-violet-500/20 text-violet-300'
                  : 'bg-white/[0.06] text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-slate-500 text-xs">{filtered.length} {t.count} {query || category !== ALL || quickFilter !== 'all' ? t.filter : ''}</p>

      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('title')}>
                  {t.product} <SortIcon col="title" />
                </th>
                {show('category') && <th className="text-left font-medium px-5 py-3">{t.category}</th>}
                {show('price')    && <th className="text-right font-medium px-5 py-3">{t.price}</th>}
                {show('cost')     && <th className="text-right font-medium px-5 py-3">{t.cost}</th>}
                {show('profit')   && (
                  <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('profit')}>
                    {t.profit} <SortIcon col="profit" />
                  </th>
                )}
                {show('margin')   && (
                  <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('margin')}>
                    {t.margin} <SortIcon col="margin" />
                  </th>
                )}
                {show('sold')     && <th className="text-right font-medium px-5 py-3">{t.sold}</th>}
                {show('stock')    && (
                  <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('available_stock')}>
                    {t.stock} <SortIcon col="available_stock" />
                  </th>
                )}
                {hasAds && show('drr') && (
                  <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-purple-300 text-purple-400/70" onClick={() => toggleSort('drr')}>
                    {t.drr} <SortIcon col="drr" />
                  </th>
                )}
                {hasAds && show('adSpend')    && <th className="text-right font-medium px-5 py-3 text-purple-400/70">{t.adSpend}</th>}
                {hasAds && show('impressions') && <th className="text-right font-medium px-5 py-3 text-purple-400/70">{t.impressions}</th>}
                {hasAds && show('clicks')      && <th className="text-right font-medium px-5 py-3 text-purple-400/70">{t.clicks}</th>}
                {hasAds && show('ctr')         && <th className="text-right font-medium px-5 py-3 text-purple-400/70">{t.ctr}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.length === 0 ? (
                <tr><td colSpan={visibleColCount} className="px-5 py-10 text-center text-slate-500 text-sm">{t.notFound}</td></tr>
              ) : filtered.map(p => {
                const price  = Number(p.selling_price ?? 0)
                const margin = price > 0 ? Number(((p.profit / price) * 100).toFixed(1)) : 0
                const ads    = p.sku ? adsStats?.[p.sku] : undefined
                const drr    = ads?.drr ?? 0
                const stockColor = p.available_stock <= thresholds.stockRed
                  ? 'bg-red-500/10 text-red-400'
                  : p.available_stock <= thresholds.stockYellow
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-slate-700/40 text-slate-300'
                const drrColor = drr === 0 ? 'text-slate-500' :
                  drr <= thresholds.drrGreen  ? 'text-emerald-400' :
                  drr <= thresholds.drrYellow ? 'text-amber-400'   : 'text-red-400'
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-white font-medium group-hover:text-violet-300 transition-colors">{p.title}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{p.sku}</p>
                        </div>
                        {p.is_shared && (
                          <span title="Shared inventory pool" className="flex-shrink-0 text-violet-400/70">
                            <Link2 className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    {show('category') && (
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-[var(--border)]">{p.category ?? '—'}</span>
                      </td>
                    )}
                    {show('price')  && <td className="px-5 py-4 text-right text-slate-300">{fmt(price)}</td>}
                    {show('cost')   && <td className="px-5 py-4 text-right text-slate-500">{fmt(Number(p.cost_price ?? 0))}</td>}
                    {show('profit') && (
                      <td className="px-5 py-4 text-right"><span className="text-emerald-400 font-semibold">{fmt(p.profit)}</span></td>
                    )}
                    {show('margin') && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${Math.min(margin, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${margin > 35 ? 'text-emerald-400' : margin > 20 ? 'text-amber-400' : 'text-red-400'}`}>{margin}%</span>
                        </div>
                      </td>
                    )}
                    {show('sold')  && <td className="px-5 py-4 text-right text-slate-300">{p.sold}</td>}
                    {show('stock') && (
                      <td className="px-5 py-4 text-right">
                        <StockCell product={p} onUpdated={handleStockUpdated} stockColorClass={stockColor} />
                      </td>
                    )}
                    {hasAds && show('drr') && (
                      <td className="px-5 py-4 text-right">
                        {ads ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                            drr <= thresholds.drrGreen  ? 'bg-emerald-500/10' :
                            drr <= thresholds.drrYellow ? 'bg-amber-500/10'   : 'bg-red-500/10'
                          } ${drrColor}`}>
                            {fmtNum(drr)}%
                          </span>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                    )}
                    {hasAds && show('adSpend')     && <td className="px-5 py-4 text-right text-purple-300 text-xs">{ads ? fmt(ads.spend) : '—'}</td>}
                    {hasAds && show('impressions') && <td className="px-5 py-4 text-right text-slate-400 text-xs">{ads ? ads.impressions.toLocaleString() : '—'}</td>}
                    {hasAds && show('clicks')      && <td className="px-5 py-4 text-right text-slate-400 text-xs">{ads ? ads.clicks.toLocaleString() : '—'}</td>}
                    {hasAds && show('ctr')         && <td className="px-5 py-4 text-right text-slate-400 text-xs">{ads ? `${fmtNum(ads.ctr)}%` : '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hint */}
      <p className="text-slate-600 text-xs flex items-center gap-1.5">
        <Link2 className="w-3 h-3 text-violet-400/60" />
        {lang === 'ru'
          ? 'Нажмите на карандаш в столбце "Склад" чтобы задать общий физический запас для товара по всем магазинам.'
          : lang === 'en'
          ? 'Click the pencil in the Stock column to set a shared physical inventory pool across all your stores for that SKU.'
          : "Ombor ustunidagi qalam belgisini bosib, ushbu SKU uchun barcha do'konlar bo'yicha umumiy jismoniy zaxirani belgilang."}
      </p>
    </div>
  )
}
