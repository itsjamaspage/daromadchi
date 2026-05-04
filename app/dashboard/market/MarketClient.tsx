'use client'

import { useState, useTransition, useCallback } from 'react'
import { Search, TrendingUp, Star, ShoppingBag, ChevronRight, ArrowUpDown, Loader2 } from 'lucide-react'
import type { UzumPublicCategory, UzumPublicProduct } from '@/lib/uzum/public'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

function ProductTable({
  products,
  userCategories,
}: {
  products: UzumPublicProduct[]
  userCategories: string[]
}) {
  if (products.length === 0) return null
  const minPrice = Math.min(...products.map(p => p.minSellPrice).filter(Boolean))
  const maxPrice = Math.max(...products.map(p => p.maxSellPrice).filter(Boolean))
  const avgPrice = products.reduce((s, p) => s + (p.minSellPrice || 0), 0) / products.length
  const totalOrders = products.reduce((s, p) => s + (p.ordersAmount || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Min narx',     value: `${fmt(minPrice)} so'm`,            color: 'text-emerald-400' },
          { label: "O'rtacha narx", value: `${fmt(avgPrice)} so'm`,           color: 'text-violet-400'  },
          { label: 'Max narx',     value: `${fmt(maxPrice)} so'm`,            color: 'text-amber-400'   },
          { label: 'Jami buyurtma', value: fmt(totalOrders),                  color: 'text-cyan-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Products table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h3 className="text-white font-semibold text-sm">Top mahsulotlar — buyurtmalar bo'yicha</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">#</th>
                <th className="text-left font-medium px-4 py-3">Mahsulot</th>
                <th className="text-right font-medium px-4 py-3">Narx</th>
                <th className="text-right font-medium px-4 py-3">Buyurtmalar</th>
                <th className="text-right font-medium px-4 py-3">Reyting</th>
                <th className="text-right font-medium px-4 py-3">Sharhlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {products.map((p, i) => {
                const inMyCategory = userCategories.some(c =>
                  c.toLowerCase().includes(p.category?.title?.toLowerCase() ?? '') ||
                  (p.category?.title ?? '').toLowerCase().includes(c.toLowerCase())
                )
                return (
                  <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors ${inMyCategory ? 'bg-violet-500/[0.03]' : ''}`}>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="text-white font-medium text-xs leading-snug max-w-xs">
                            {p.title}
                            {inMyCategory && (
                              <span className="ml-2 text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/20">
                                Sizning kategoriyangiz
                              </span>
                            )}
                          </p>
                          {p.shopTitle && (
                            <p className="text-slate-500 text-[10px] mt-0.5">{p.shopTitle}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-slate-300 text-xs font-medium">{fmt(p.minSellPrice)} so'm</p>
                      {p.minFullPrice > p.minSellPrice && (
                        <p className="text-slate-600 text-[10px] line-through">{fmt(p.minFullPrice)} so'm</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-bold text-xs ${p.ordersAmount > 1000 ? 'text-emerald-400' : p.ordersAmount > 100 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {fmt(p.ordersAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-slate-300 text-xs">{p.rating?.toFixed(1) ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-500 text-xs">
                      {fmt(p.reviewsAmount ?? 0)}
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

interface Props {
  initialCategories: UzumPublicCategory[]
  userCategories: string[]
}

type SortOption = 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC'

const SORT_LABELS: Record<SortOption, string> = {
  ORDER_COUNT_DESC: 'Buyurtmalar ↓',
  PRICE_ASC:        'Narx ↑',
  PRICE_DESC:       'Narx ↓',
  RATING_DESC:      'Reyting ↓',
}

export default function MarketClient({ initialCategories, userCategories }: Props) {
  const [selectedCat, setSelectedCat] = useState<UzumPublicCategory | null>(null)
  const [products, setProducts]       = useState<UzumPublicProduct[]>([])
  const [total, setTotal]             = useState(0)
  const [sort, setSort]               = useState<SortOption>('ORDER_COUNT_DESC')
  const [searchQuery, setSearchQuery] = useState('')
  const [mode, setMode]               = useState<'category' | 'search'>('category')
  const [isPending, startTransition]  = useTransition()

  const loadCategory = useCallback((cat: UzumPublicCategory, s: SortOption = sort) => {
    setSelectedCat(cat)
    setMode('category')
    startTransition(async () => {
      const res = await fetch(`/api/market/products?categoryId=${cat.id}&sort=${s}`)
      if (res.ok) {
        const data = await res.json() as { products: UzumPublicProduct[]; total: number }
        setProducts(data.products)
        setTotal(data.total)
      }
    })
  }, [sort])

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return
    setMode('search')
    setSelectedCat(null)
    startTransition(async () => {
      const res = await fetch(`/api/market/products?q=${encodeURIComponent(searchQuery)}&sort=${sort}`)
      if (res.ok) {
        const data = await res.json() as { products: UzumPublicProduct[]; total: number }
        setProducts(data.products)
        setTotal(data.total)
      }
    })
  }, [searchQuery, sort])

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort)
    if (mode === 'category' && selectedCat) {
      loadCategory(selectedCat, newSort)
    } else if (mode === 'search' && searchQuery.trim()) {
      startTransition(async () => {
        const res = await fetch(`/api/market/products?q=${encodeURIComponent(searchQuery)}&sort=${newSort}`)
        if (res.ok) {
          const data = await res.json() as { products: UzumPublicProduct[]; total: number }
          setProducts(data.products)
          setTotal(data.total)
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Mahsulot nomini qidiring…"
            className="w-full bg-[#13131f] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          {isPending && mode === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Qidirish
        </button>
      </div>

      {/* Category grid */}
      <div>
        <p className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wide">Kategoriyalar</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {initialCategories.slice(0, 20).map(cat => (
            <button
              key={cat.id}
              onClick={() => loadCategory(cat)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                selectedCat?.id === cat.id
                  ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                  : 'bg-[#13131f] border-white/[0.06] text-slate-300 hover:border-violet-500/30 hover:text-white'
              }`}
            >
              <span className="truncate">{cat.title}</span>
              {isPending && selectedCat?.id === cat.id
                ? <Loader2 className="w-3 h-3 shrink-0 animate-spin text-violet-400" />
                : <ChevronRight className="w-3 h-3 shrink-0 text-slate-600" />
              }
            </button>
          ))}
        </div>
      </div>

      {/* Results header */}
      {products.length > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">
              {mode === 'category' ? selectedCat?.title : `"${searchQuery}" natijalari`}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">{fmt(total)} mahsulot</p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sort}
              onChange={e => handleSortChange(e.target.value as SortOption)}
              className="bg-[#13131f] border border-white/[0.06] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500/40"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map(k => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isPending && (
        <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          <span className="text-sm">Yuklanmoqda…</span>
        </div>
      )}

      {/* Product table */}
      {!isPending && products.length > 0 && (
        <ProductTable products={products} userCategories={userCategories} />
      )}

      {/* Empty state after selection */}
      {!isPending && products.length === 0 && (selectedCat || mode === 'search') && (
        <div className="text-center py-12 text-slate-500 text-sm">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-slate-700" />
          Ma'lumot topilmadi
        </div>
      )}
    </div>
  )
}
