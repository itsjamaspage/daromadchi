'use client'

import { useState, useTransition, useCallback } from 'react'
import { Search, TrendingUp, Star, ShoppingBag, ChevronRight, ArrowUpDown, Loader2 } from 'lucide-react'
import type { UzumPublicCategory, UzumPublicProduct } from '@/lib/uzum/public'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

type MarketT = (typeof dashT)['uz']['market']

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

// ─── Uzum product table ───────────────────────────────────────────────────────

function UzumProductTable({ products, userCategories, t }: { products: UzumPublicProduct[]; userCategories: string[]; t: MarketT }) {
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
          { label: t.minPrice,    value: `${fmt(minP)} so'm`, color: 'text-emerald-400' },
          { label: t.avgPrice,    value: `${fmt(avgP)} so'm`, color: 'text-violet-400'  },
          { label: t.maxPrice,    value: `${fmt(maxP)} so'm`, color: 'text-amber-400'   },
          { label: t.totalOrders, value: fmt(totalO),          color: 'text-cyan-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[var(--text-muted)] text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h3 className="text-[var(--text-base)] font-semibold text-sm">{t.topProducts}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">{t.product}</th>
                <th className="text-right px-4 py-3 font-medium">{t.price}</th>
                <th className="text-right px-4 py-3 font-medium">{t.orders}</th>
                <th className="text-right px-4 py-3 font-medium">{t.rating}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {products.map((p, i) => {
                const mine = userCategories.some(c =>
                  c.toLowerCase().includes((p.category?.title ?? '').toLowerCase()) ||
                  (p.category?.title ?? '').toLowerCase().includes(c.toLowerCase())
                )
                return (
                  <tr key={p.id} className={`hover:bg-[var(--bg-card2)] transition-colors ${mine ? 'bg-violet-500/[0.03]' : ''}`}>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[var(--text-base)] text-xs font-medium leading-snug max-w-xs">
                        {p.title}
                        {mine && <span className="ml-2 text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/20">{t.yourCategory}</span>}
                      </p>
                      {p.shopTitle && <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{p.shopTitle}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-[var(--text-dim)] text-xs font-medium">{fmt(p.minSellPrice)} so'm</p>
                      {p.minFullPrice > p.minSellPrice && <p className="text-[var(--text-muted)] text-[10px] line-through">{fmt(p.minFullPrice)} so'm</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-bold text-xs ${p.ordersAmount > 1000 ? 'text-emerald-400' : p.ordersAmount > 100 ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
                        {fmt(p.ordersAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-[var(--text-dim)] text-xs">{p.rating?.toFixed(1) ?? '—'}</span>
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

function YandexModelTable({ models, t }: { models: YandexModel[]; t: MarketT }) {
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
          { label: t.minPrice, value: `${fmt(minP)} ${cur}`, color: 'text-emerald-400' },
          { label: t.avgPrice, value: `${fmt(avgP)} ${cur}`, color: 'text-amber-400'   },
          { label: t.maxPrice, value: `${fmt(maxP)} ${cur}`, color: 'text-red-400'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[var(--text-muted)] text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-[var(--text-base)] font-semibold text-sm">{t.topModels}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">{t.model}</th>
                <th className="text-right px-4 py-3 font-medium">{t.priceRange}</th>
                <th className="text-right px-4 py-3 font-medium">{t.rating}</th>
                <th className="text-right px-4 py-3 font-medium">{t.reviews}</th>
                <th className="text-right px-4 py-3 font-medium">{t.offers}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {models.map((m, i) => (
                <tr key={m.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                  <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{i + 1}</td>
                  <td className="px-4 py-3.5 text-[var(--text-base)] text-xs font-medium max-w-xs">{m.name}</td>
                  <td className="px-4 py-3.5 text-right text-xs text-[var(--text-dim)]">
                    {m.prices ? `${fmt(m.prices.min)}–${fmt(m.prices.max)} ${cur}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span className="text-[var(--text-dim)] text-xs">{m.rating?.toFixed(1) ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-muted)] text-xs">{m.reviewCount ?? '—'}</td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-muted)] text-xs">{m.offersCount ?? '—'}</td>
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
  const { lang } = useLang()
  const t = dashT[lang].market
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
    { value: 'ORDER_COUNT_DESC', label: t.sortOrders   },
    { value: 'PRICE_ASC',        label: t.sortPriceAsc  },
    { value: 'PRICE_DESC',       label: t.sortPriceDesc },
    { value: 'RATING_DESC',      label: t.sortRating    },
  ]
  const YANDEX_SORTS: { value: SortYandex; label: string }[] = [
    { value: 'OPINIONS', label: t.sortOpinions },
    { value: 'PRICE',    label: t.sortPrice    },
    { value: 'QUALITY',  label: t.sortQuality  },
  ]

  const accentActive  = marketplace === 'yandex' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
  const accentHover   = 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={t.searchPlaceholder}
              className={`w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none ${searchBorder} transition-colors`}
            />
          </div>
          <button onClick={handleSearch}
            className={`${btnColor} text-[var(--text-base)] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2`}>
            {isPending && mode === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t.search}
          </button>
        </div>
      )}

      {/* Category grid */}
      <div>
        <p className="text-[var(--text-muted)] text-xs font-medium mb-3 uppercase tracking-wide">{t.categories}</p>
        {isPending && !selectedCat && marketplace === 'yandex' ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> {t.loading}
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
                    active ? accentActive : `bg-[var(--bg-card2)] border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text-base)] ${accentHover}`
                  }`}
                >
                  <span className="truncate">{title}</span>
                  {isPending && active
                    ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                    : <ChevronRight className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
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
            <p className="text-[var(--text-base)] font-semibold text-sm">
              {mode === 'category' ? selectedCat?.title : `"${searchQuery}" ${t.resultsSuffix}`}
            </p>
            {marketplace === 'uzum' && (
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{fmt(total)} {t.productsCount}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            {marketplace === 'uzum' ? (
              <select value={sortUzum}
                onChange={e => {
                  const s = e.target.value as SortUzum; setSortUzum(s)
                  if (selectedCat) loadUzumCategory(selectedCat, s)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-dim)] text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {UZUM_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <select value={sortYandex}
                onChange={e => {
                  const s = e.target.value as SortYandex; setSortYandex(s)
                  if (selectedCat) loadYandexCategory({ id: selectedCat.id, name: selectedCat.title }, s)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-dim)] text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {YANDEX_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {isPending && selectedCat && (
        <div className="flex items-center justify-center py-12 gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          <span className="text-sm">{t.loading}</span>
        </div>
      )}

      {/* Results */}
      {!isPending && marketplace === 'uzum' && uzumProducts.length > 0 && (
        <UzumProductTable products={uzumProducts} userCategories={userCategories} t={t} />
      )}
      {!isPending && marketplace === 'yandex' && yandexModels.length > 0 && (
        <YandexModelTable models={yandexModels} t={t} />
      )}

      {/* Empty */}
      {!isPending && !hasResults && selectedCat && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-[var(--text-dim)]" />
          {t.notFound}
        </div>
      )}
    </div>
  )
}
