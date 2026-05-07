'use client'

import { useState, useMemo } from 'react'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'
import type { SearchPhrase } from '@/lib/types'

function fs(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

type SortKey = 'impressions' | 'clicks' | 'ctr' | 'orders' | 'spend'

interface Props { phrases: SearchPhrase[] }

export default function SearchPhrasesView({ phrases }: Props) {
  const [search, setSearch]           = useState('')
  const [productFilter, setProductFilter] = useState('all')
  const [sortKey, setSortKey]         = useState<SortKey>('impressions')
  const [sortDir, setSortDir]         = useState<'asc'|'desc'>('desc')

  const products = useMemo(() => {
    const set = new Set(phrases.map(p => p.productTitle))
    return ['all', ...set]
  }, [phrases])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return phrases
      .filter(p =>
        (productFilter === 'all' || p.productTitle === productFilter) &&
        (!q || p.phrase.toLowerCase().includes(q) || p.productTitle.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const av = a[sortKey] as number
        const bv = b[sortKey] as number
        return sortDir === 'asc' ? av - bv : bv - av
      })
  }, [phrases, search, productFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-violet-400" /> : <ChevronDown className="w-3 h-3 text-violet-400" />
  }

  function exportExcel() {
    const header = ['Ibora', 'Mahsulot', 'Ko\'rsatuvlar', 'Kliklar', 'CTR', 'Buyurtmalar', 'Sarflar'].join('\t')
    const rows = filtered.map(p =>
      [p.phrase, p.productTitle, p.impressions, p.clicks, p.ctr.toFixed(2)+'%', p.orders, Math.round(p.spend)].join('\t')
    )
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'qidiruv-iboralari.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ibora qidirish..."
            className="w-full pl-9 pr-3 py-2 bg-[#13131f] border border-white/[0.06] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50" />
        </div>
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-[#13131f] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50">
          <option value="all">Barcha mahsulotlar</option>
          {products.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 bg-[#13131f] hover:bg-white/[0.04] text-slate-400 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.06] transition-all sm:ml-auto w-fit">
          <Download className="w-3.5 h-3.5" /> Excel
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jami iboralar',  value: `${filtered.length} ta` },
          { label: 'Jami kliklar',   value: filtered.reduce((s,p)=>s+p.clicks,0).toLocaleString('uz-UZ') },
          { label: 'O\'rtacha CTR',  value: filtered.length ? (filtered.reduce((s,p)=>s+p.ctr,0)/filtered.length).toFixed(2)+'%' : '—' },
          { label: 'Jami sarflar',   value: fs(filtered.reduce((s,p)=>s+p.spend,0)) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Ibora</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Mahsulot</th>
                {([
                  ['impressions', "Ko'rsatuvlar"],
                  ['clicks',      'Kliklar'],
                  ['ctr',         'CTR'],
                  ['orders',      'Buyurtmalar'],
                  ['spend',       'Sarflar'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-300 whitespace-nowrap transition-colors">
                    <span className="flex items-center gap-1">{label}<SortIcon col={key} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3">
                    <span className="text-white text-xs font-medium">{p.phrase}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-slate-400 text-xs truncate max-w-[160px] block">{p.productTitle}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-300 text-xs">{p.impressions.toLocaleString('uz-UZ')}</td>
                  <td className="px-3 py-3 text-slate-300 text-xs">{p.clicks.toLocaleString('uz-UZ')}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold ${p.ctr >= 2.5 ? 'text-emerald-400' : p.ctr >= 1.5 ? 'text-amber-400' : 'text-red-400'}`}>
                      {p.ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white text-xs font-semibold">{p.orders}</span>
                      {p.orders === 0 && p.spend > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Sotuv yo'q" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-red-400 text-xs">{fs(p.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
