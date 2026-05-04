'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ExportButton from './ExportButton'
import type { Product } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const [query,   setQuery]   = useState('')
  const [sortBy,  setSortBy]  = useState<'title' | 'profit' | 'margin' | 'stock_quantity'>('profit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return ['Barchasi', ...cats]
  }, [products])
  const [category, setCategory] = useState('Barchasi')

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
    if (category !== 'Barchasi') rows = rows.filter(p => p.category === category)
    rows.sort((a, b) => {
      const av = sortBy === 'margin'
        ? a.profit / (Number(a.selling_price) || 1)
        : (a as any)[sortBy]
      const bv = sortBy === 'margin'
        ? b.profit / (Number(b.selling_price) || 1)
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
    'Mahsulot': p.title,
    'SKU': p.sku ?? '',
    'Kategoriya': p.category ?? '',
    "Narx (so'm)": p.selling_price ?? 0,
    "Tannarx (so'm)": p.cost_price ?? 0,
    "Foyda (so'm)": p.profit,
    'Margin (%)': (p.profit / (Number(p.selling_price) || 1) * 100).toFixed(1),
    'Sotilgan': p.sold ?? 0,
    'Ombor': p.stock_quantity,
  }))

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-slate-700 ml-1">↕</span>
    return <span className="text-violet-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  return (
    <div className="space-y-4">
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
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                category === c
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                  : 'text-slate-400 border-white/[0.06] hover:text-white hover:border-white/[0.12]'
              }`}
            >
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
                <th className="text-right font-medium px-5 py-3">Tannarx</th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('profit')}>
                  Foyda <SortIcon col="profit" />
                </th>
                <th className="text-right font-medium px-5 py-3 cursor-pointer select-none hover:text-slate-300" onClick={() => toggleSort('margin')}>
                  Margin <SortIcon col="margin" />
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
                const stockLow = p.stock_quantity < 20
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium group-hover:text-violet-300 transition-colors">{p.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{p.sku}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">{p.category ?? '—'}</span>
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
                    <td className="px-5 py-4 text-right text-slate-300">{p.sold ?? 0}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${stockLow ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/40 text-slate-300'}`}>{p.stock_quantity}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
