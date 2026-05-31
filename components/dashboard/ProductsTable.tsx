'use client'

import { useState, useMemo, useRef } from 'react'
import { Search, Link2, Pencil, Check, X } from 'lucide-react'
import ExportButton from './ExportButton'
import type { Product } from '@/lib/types'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

const ALL = 'Barchasi'

// Inline editor for physical_stock — shown in the stock column
function StockCell({ product, onUpdated }: { product: Product; onUpdated: (sku: string, val: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(product.physical_stock ?? ''))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const stockLow = product.available_stock < 20

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
        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${stockLow ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/40 text-slate-300'}`}>
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

export default function ProductsTable({ products: initialProducts }: { products: Product[] }) {
  const { lang } = useLang()
  const t = dashT[lang].products
  const [products, setProducts] = useState(initialProducts)
  const [query,    setQuery]    = useState('')
  const [sortBy,   setSortBy]   = useState<'title' | 'profit' | 'margin' | 'available_stock'>('profit')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return [ALL, ...cats]
  }, [products])
  const [category, setCategory] = useState(ALL)

  // Optimistic update after physical_stock edit
  function handleStockUpdated(sku: string, physical_stock: number | null) {
    setProducts(prev => {
      // Recompute available_stock for all products with this SKU
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
    rows.sort((a, b) => {
      const av = sortBy === 'margin'
        ? a.profit / (Number(a.selling_price) || 1)
        : sortBy === 'available_stock'
        ? a.available_stock
        : (a as any)[sortBy]
      const bv = sortBy === 'margin'
        ? b.profit / (Number(b.selling_price) || 1)
        : sortBy === 'available_stock'
        ? b.available_stock
        : (b as any)[sortBy]
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [products, query, category, sortBy, sortDir])

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

  return (
    <div className="space-y-4">
      {/* Filters */}
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
        <div className="sm:ml-auto">
          <ExportButton data={exportData} filename={t.exportFilename} />
        </div>
      </div>

      <p className="text-slate-500 text-xs">{filtered.length} {t.count} {query || category !== ALL ? t.filter : ''}</p>

      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('title')}>
                  {t.product} <SortIcon col="title" />
                </th>
                <th className="text-left font-medium px-5 py-3">{t.category}</th>
                <th className="text-right font-medium px-5 py-3">{t.price}</th>
                <th className="text-right font-medium px-5 py-3">{t.cost}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('profit')}>
                  {t.profit} <SortIcon col="profit" />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('margin')}>
                  {t.margin} <SortIcon col="margin" />
                </th>
                <th className="text-right font-medium px-5 py-3">{t.sold}</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('available_stock')}>
                  {t.stock} <SortIcon col="available_stock" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500 text-sm">{t.notFound}</td></tr>
              ) : filtered.map(p => {
                const price  = Number(p.selling_price ?? 0)
                const margin = price > 0 ? Number(((p.profit / price) * 100).toFixed(1)) : 0
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
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-[var(--border)]">{p.category ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">{fmt(price)}</td>
                    <td className="px-5 py-4 text-right text-slate-500">{fmt(Number(p.cost_price ?? 0))}</td>
                    <td className="px-5 py-4 text-right"><span className="text-emerald-400 font-semibold">{fmt(p.profit)}</span></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${Math.min(margin, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${margin > 35 ? 'text-emerald-400' : margin > 20 ? 'text-amber-400' : 'text-red-400'}`}>{margin}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">{p.sold}</td>
                    <td className="px-5 py-4 text-right">
                      <StockCell product={p} onUpdated={handleStockUpdated} />
                    </td>
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
