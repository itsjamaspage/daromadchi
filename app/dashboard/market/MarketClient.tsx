'use client'

import { useState, useTransition, useCallback } from 'react'
import { Search, TrendingUp, Star, ShoppingBag, ChevronRight, ArrowUpDown, Loader2 } from 'lucide-react'
import type { UzumPublicCategory, UzumPublicProduct } from '@/lib/uzum/public'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

// ─── Uzum product table ───────────────────────────────────────────────────────

function UzumProductTable({ products, userCategories }: { products: UzumPublicProduct[]; userCategories: string[] }) {
  if (!products.length) return null
  const prices = products.map(p => p.minSellPrice).filter(Boolean)
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const avgP   = prices.reduce((s, v) => s + v, 0) / (prices.length || 1)
  const totalO = products.reduce((s, p) => s + (p.ordersAmount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Min narx',      value: `${fmt(minP)} so'm`, color: 'text-emerald-400' },
          { label: "O'rtacha narx", value: `${fmt(avgP)} so'm`, color: 'text-violet-400'  },
          { label: 'Max narx',      value: `${fmt(maxP)} so'm`, color: 'text-amber-400'   },
          { label: 'Jami buyurtma', value: fmt(totalO),          color: 'text-cyan-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h3 className="text-white font-semibold text-sm">Top mahsulotlar — buyurtmalar bo'yicha</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Mahsulot</th>
                <th className="text-right px-4 py-3 font-medium">Narx</th>
                <th className="text-right px-4 py-3 font-medium">Buyurtmalar</th>
                <th className="text-right px-4 py-3 font-medium">Reyting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {products.map((p, i) => {
                const mine = userCategories.some(c =>
                  c.toLowerCase().includes((p.category?.title ?? '').toLowerCase()) ||
                  (p.category?.title ?? '').toLowerCase().includes(c.toLowerCase())
                )
                return (
                  <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors ${mine ? 'bg-violet-500/[0.03]' : ''}`}>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-white text-xs font-medium leading-snug max-w-xs">
                        {p.title}
                        {mine && <span className="ml-2 text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/20">Sizning kategoriya</span>}
                      </p>
                      {p.shopTitle && <p className="text-slate-500 text-[10px] mt-0.5">{p.shopTitle}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-slate-300 text-xs font-medium">{fmt(p.minSellPrice)} so'm</p>
                      {p.minFullPrice > p.minSellPrice && <p className="text-slate-600 text-[10px] line-through">{fmt(p.minFullPrice)} so'm</p>}
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

// ─── Yandex model table ───────────────────────────────────────────────────────

interface YandexModel {
  id: number; name: string
  prices?: { min: number; max: number; avg: number; cur: string }
  rating?: number; reviewCount?: number; offersCount?: number
}

function YandexModelTable({ models }: { models: YandexModel[] }) {
  if (!models.length) return null
  const withPrices = models.filter(m => m.prices?.avg)
  const avgP = withPrices.length
    ? withPrices.reduce((s, m) => s + (m.prices?.avg ?? 0), 0) / withPrices.length : 0
  const minP = withPrices.length ? Math.min(...withPrices.map(m => m.prices?.min ?? 0)) : 0
  const maxP = withPrices.length ? Math.max(...withPrices.map(m => m.prices?.max ?? 0)) : 0
  const cur  = withPrices[0]?.prices?.cur ?? '₽'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Min narx',      value: `${fmt(minP)} ${cur}`, color: 'text-emerald-400' },
          { label: "O'rtacha narx", value: `${fmt(avgP)} ${cur}`, color: 'text-amber-400'   },
          { label: 'Max narx',      value: `${fmt(maxP)} ${cur}`, color: 'text-red-400'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-white font-semibold text-sm">Yandex Market — top modellar</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-right px-4 py-3 font-medium">Narx diapazoni</th>
                <th className="text-right px-4 py-3 font-medium">Reyting</th>
                <th className="text-right px-4 py-3 font-medium">Sharhlar</th>
                <th className="text-right px-4 py-3 font-medium">Takliflar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {models.map((m, i) => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3.5 text-white text-xs font-medium max-w-xs">{m.name}</td>
                  <td className="px-4 py-3.5 text-right text-xs text-slate-300">
                    {m.prices ? `${fmt(m.prices.min)}–${fmt(m.prices.max)} ${cur}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span className="text-slate-300 text-xs">{m.rating?.toFixed(1) ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{m.reviewCount ?? '—'}</td>
                  <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{m.offersCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

type SortUzum = 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC'
type SortYandex = 'OPINIONS' | 'PRICE' | 'QUALITY'

interface Props {
  marketplace:       'uzum' | 'yandex'
  initialCategories: UzumPublicCategory[]
  userCategories:    string[]
}

export default function MarketClient({ marketplace, initialCategories, userCategories }: Props) {
  const [selectedCat,  setSelectedCat]  = useState<{ id: number; title: string } | null>(null)
  const [uzumProducts, setUzumProducts] = useState<UzumPublicProduct[]>([])
  const [yandexCats,   setYandexCats]   = useState<{ id: number; name: string }[]>([])
  const [yandexModels, setYandexModels] = useState<YandexModel[]>([])
  const [total,        setTotal]        = useState(0)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [sortUzum,     setSortUzum]     = useState<SortUzum>('ORDER_COUNT_DESC')
  const [sortYandex,   setSortYandex]   = useState<SortYandex>('OPINIONS')
  const [mode,         setMode]         = useState<'category' | 'search'>('category')
  const [catsLoaded,   setCatsLoaded]   = useState(false)
  const [isPending,    startTransition] = useTransition()

  // Load Yandex categories on first render
  const loadYandexCats = useCallback(() => {
    if (catsLoaded) return
    setCatsLoaded(true)
    startTransition(async () => {
      const res = await fetch('/api/market/yandex?action=categories')
      if (res.ok) {
        const data = await res.json() as { categories: { id: number; name: string }[] }
        setYandexCats(data.categories ?? [])
      }
    })
  }, [catsLoaded])

  const loadUzumCategory = useCallback((cat: { id: number; title: string }, s: SortUzum = sortUzum) => {
    setSelectedCat(cat); setMode('category')
    startTransition(async () => {
      const res = await fetch(`/api/market/products?categoryId=${cat.id}&sort=${s}`)
      if (res.ok) {
        const d = await res.json() as { products: UzumPublicProduct[]; total: number }
        setUzumProducts(d.products); setTotal(d.total)
      }
    })
  }, [sortUzum])

  const loadYandexCategory = useCallback((cat: { id: number; name: string }, s: SortYandex = sortYandex) => {
    setSelectedCat({ id: cat.id, title: cat.name }); setMode('category')
    startTransition(async () => {
      const res = await fetch(`/api/market/yandex?action=models&categoryId=${cat.id}&sort=${s}`)
      if (res.ok) {
        const d = await res.json() as { models: YandexModel[] }
        setYandexModels(d.models ?? [])
      }
    })
  }, [sortYandex])

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || marketplace !== 'uzum') return
    setMode('search'); setSelectedCat(null)
    startTransition(async () => {
      const res = await fetch(`/api/market/products?q=${encodeURIComponent(searchQuery)}&sort=${sortUzum}`)
      if (res.ok) {
        const d = await res.json() as { products: UzumPublicProduct[]; total: number }
        setUzumProducts(d.products); setTotal(d.total)
      }
    })
  }, [searchQuery, sortUzum, marketplace])

  // Auto-load Yandex categories when tab is yandex
  if (marketplace === 'yandex' && !catsLoaded && typeof window !== 'undefined') {
    loadYandexCats()
  }

  const UZUM_SORTS: { value: SortUzum; label: string }[] = [
    { value: 'ORDER_COUNT_DESC', label: 'Buyurtmalar ↓' },
    { value: 'PRICE_ASC',        label: 'Narx ↑'        },
    { value: 'PRICE_DESC',       label: 'Narx ↓'        },
    { value: 'RATING_DESC',      label: 'Reyting ↓'     },
  ]
  const YANDEX_SORTS: { value: SortYandex; label: string }[] = [
    { value: 'OPINIONS', label: 'Fikrlar ↓' },
    { value: 'PRICE',    label: 'Narx'       },
    { value: 'QUALITY',  label: 'Sifat'      },
  ]

  const accentActive  = marketplace === 'yandex' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
  const accentHover   = 'text-slate-500 hover:text-slate-300'
  const searchBorder  = marketplace === 'yandex' ? 'focus:border-amber-500/40' : 'focus:border-violet-500/40'
  const btnColor      = marketplace === 'yandex' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-violet-600 hover:bg-violet-500'
  const cats          = marketplace === 'uzum' ? initialCategories : yandexCats

  const hasResults = marketplace === 'uzum' ? uzumProducts.length > 0 : yandexModels.length > 0

  return (
    <div className="space-y-6">
      {/* Search — Uzum only */}
      {marketplace === 'uzum' && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Mahsulot nomini qidiring…"
              className={`w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${searchBorder} transition-colors`}
            />
          </div>
          <button onClick={handleSearch}
            className={`${btnColor} text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2`}>
            {isPending && mode === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Qidirish
          </button>
        </div>
      )}

      {/* Category grid */}
      <div>
        <p className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wide">Kategoriyalar</p>
        {isPending && !selectedCat && marketplace === 'yandex' ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {cats.slice(0, 20).map(cat => {
              const id    = cat.id
              const title = 'title' in cat ? cat.title : (cat as { name: string }).name
              const active = selectedCat?.id === id
              return (
                <button key={id}
                  onClick={() => marketplace === 'uzum'
                    ? loadUzumCategory({ id, title })
                    : loadYandexCategory({ id, name: title })}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    active ? accentActive : `bg-[var(--bg-card2)] border-[var(--border)] text-slate-300 hover:text-white ${accentHover}`
                  }`}
                >
                  <span className="truncate">{title}</span>
                  {isPending && active
                    ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                    : <ChevronRight className="w-3 h-3 shrink-0 text-slate-600" />
                  }
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Results header */}
      {hasResults && !isPending && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">
              {mode === 'category' ? selectedCat?.title : `"${searchQuery}" natijalari`}
            </p>
            {marketplace === 'uzum' && (
              <p className="text-slate-500 text-xs mt-0.5">{fmt(total)} mahsulot</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            {marketplace === 'uzum' ? (
              <select value={sortUzum}
                onChange={e => {
                  const s = e.target.value as SortUzum; setSortUzum(s)
                  if (selectedCat) loadUzumCategory(selectedCat, s)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {UZUM_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <select value={sortYandex}
                onChange={e => {
                  const s = e.target.value as SortYandex; setSortYandex(s)
                  if (selectedCat) loadYandexCategory({ id: selectedCat.id, name: selectedCat.title }, s)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {YANDEX_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {isPending && selectedCat && (
        <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          <span className="text-sm">Yuklanmoqda…</span>
        </div>
      )}

      {/* Results */}
      {!isPending && marketplace === 'uzum' && uzumProducts.length > 0 && (
        <UzumProductTable products={uzumProducts} userCategories={userCategories} />
      )}
      {!isPending && marketplace === 'yandex' && yandexModels.length > 0 && (
        <YandexModelTable models={yandexModels} />
      )}

      {/* Empty */}
      {!isPending && !hasResults && selectedCat && (
        <div className="text-center py-12 text-slate-500 text-sm">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-slate-700" />
          Ma&apos;lumot topilmadi
        </div>
      )}
    </div>
  )
}
