'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { Search, TrendingUp, Star, ShoppingBag, ChevronRight, ArrowUpDown, Loader2, Flame, DollarSign } from 'lucide-react'
import type { UzumPublicCategory, UzumPublicProduct } from '@/lib/uzum/public'
import type { WbPublicProduct } from '@/lib/wildberries/public'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

type MarketT = (typeof dashT)['uz']['market']

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

// ─── Uzum product table ───────────────────────────────────────────────────────

function fmtRevenue(n: number, unit: string) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B ${unit}`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M ${unit}`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K ${unit}`
  return `${fmt(n)} ${unit}`
}

function UzumProductTable({ products, userCategories, t }: { products: UzumPublicProduct[]; userCategories: string[]; t: MarketT }) {
  if (!products.length) return null
  const prices = products.map(p => p.minSellPrice).filter(Boolean)
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const avgP   = prices.reduce((s, v) => s + v, 0) / (prices.length || 1)
  const totalO = products.reduce((s, p) => s + (p.ordersAmount || 0), 0)

  // Revenue = ordersAmount × minSellPrice (real cumulative data from Uzum)
  const withRev = products.map(p => ({ ...p, revenue: p.ordersAmount * p.minSellPrice }))
  const topRevenue = [...withRev].sort((a, b) => b.revenue - a.revenue)
  const totalRev = withRev.reduce((s, p) => s + p.revenue, 0)
  const maxRev = topRevenue[0]?.revenue ?? 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.minPrice,    value: `${fmt(minP)} so'm`,           color: 'text-emerald-400' },
          { label: t.avgPrice,    value: `${fmt(avgP)} so'm`,           color: 'text-violet-400'  },
          { label: t.maxPrice,    value: `${fmt(maxP)} so'm`,           color: 'text-amber-400'   },
          { label: t.totalOrders, value: fmt(totalO),                   color: 'text-cyan-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[var(--text-muted)] text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Revenue analysis card */}
      <div className="bg-[var(--bg-card2)] border border-emerald-500/20 rounded-2xl p-5"
        style={{ background: 'color-mix(in srgb, #10b981 5%, var(--bg-card2))' }}>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[var(--text-base)] font-semibold text-sm">{t.topRevenueProducts}</h3>
          <span className="ml-auto text-xs text-emerald-400 font-bold">{fmtRevenue(totalRev, "so'm")}</span>
        </div>
        <div className="space-y-2">
          {topRevenue.slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <p className="text-[var(--text-dim)] text-xs truncate flex-1 min-w-0">{p.title}</p>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((p.revenue / maxRev) * 100)}%` }} />
                </div>
                <span className="text-emerald-400 text-xs font-bold w-20 text-right">{fmtRevenue(p.revenue, "so'm")}</span>
              </div>
            </div>
          ))}
        </div>
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
                <th className="text-right px-4 py-3 font-medium">{t.revenueCol}</th>
                <th className="text-right px-4 py-3 font-medium">{t.rating}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {withRev.map((p, i) => {
                const mine = userCategories.some(c =>
                  c.toLowerCase().includes((p.category?.title ?? '').toLowerCase()) ||
                  (p.category?.title ?? '').toLowerCase().includes(c.toLowerCase())
                )
                const isTrending = p.ordersAmount > 500
                return (
                  <tr key={p.id} className={`hover:bg-[var(--bg-card2)] transition-colors ${mine ? 'bg-violet-500/[0.03]' : ''}`}>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[var(--text-base)] text-xs font-medium leading-snug max-w-xs flex items-center gap-1.5 flex-wrap">
                        {isTrending && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                        {p.title}
                        {mine && <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/20">{t.yourCategory}</span>}
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
                      <span className="text-emerald-400 text-xs font-semibold">{fmtRevenue(p.revenue, "so'm")}</span>
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

// ─── Wildberries product table ────────────────────────────────────────────────

function WbProductTable({ products, t }: { products: WbPublicProduct[]; t: MarketT }) {
  if (!products.length) return null
  const prices = products.map(p => p.sellPrice).filter(Boolean)
  const minP   = prices.length ? Math.min(...prices) : 0
  const maxP   = prices.length ? Math.max(...prices) : 0
  const avgP   = prices.length ? prices.reduce((s, v) => s + v, 0) / prices.length : 0

  // Revenue estimate: feedbacks × 15 × price (industry: ~1 review per 15 purchases)
  const withRev = products.map(p => ({ ...p, revenue: p.feedbacks * 15 * p.sellPrice }))
  const topRevenue = [...withRev].sort((a, b) => b.revenue - a.revenue)
  const totalRev = withRev.reduce((s, p) => s + p.revenue, 0)
  const maxRev = topRevenue[0]?.revenue ?? 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: t.minPrice, value: `${fmt(minP)} ₽`, color: 'text-emerald-400' },
          { label: t.avgPrice, value: `${fmt(avgP)} ₽`, color: 'text-amber-400'   },
          { label: t.maxPrice, value: `${fmt(maxP)} ₽`, color: 'text-red-400'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[var(--text-muted)] text-xs mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Revenue analysis card */}
      <div className="bg-[var(--bg-card2)] border border-pink-500/20 rounded-2xl p-5"
        style={{ background: 'color-mix(in srgb, #cb11ab 5%, var(--bg-card2))' }}>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4" style={{ color: '#cb11ab' }} />
          <h3 className="text-[var(--text-base)] font-semibold text-sm">{t.topRevenueProducts}</h3>
          <span className="ml-auto text-xs font-bold" style={{ color: '#cb11ab' }}>{fmtRevenue(totalRev, '₽')}</span>
        </div>
        <div className="space-y-2">
          {topRevenue.slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <p className="text-[var(--text-dim)] text-xs truncate flex-1 min-w-0">{p.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((p.revenue / maxRev) * 100)}%`, background: '#cb11ab' }} />
                </div>
                <span className="text-xs font-bold w-20 text-right" style={{ color: '#cb11ab' }}>{fmtRevenue(p.revenue, '₽')}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[var(--text-muted)] text-[10px] mt-3">{t.estRevenueNote}</p>
      </div>

      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: '#cb11ab' }} />
          <h3 className="text-[var(--text-base)] font-semibold text-sm">{t.topProducts}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">{t.product}</th>
                <th className="text-right px-4 py-3 font-medium">{t.price}</th>
                <th className="text-right px-4 py-3 font-medium">{t.reviews}</th>
                <th className="text-right px-4 py-3 font-medium">{t.revenueCol}</th>
                <th className="text-right px-4 py-3 font-medium">{t.rating}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {withRev.map((p, i) => {
                const isTrending = p.feedbacks > 200
                return (
                  <tr key={p.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[var(--text-base)] text-xs font-medium leading-snug max-w-xs flex items-center gap-1.5 flex-wrap">
                        {isTrending && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                        {p.name}
                      </p>
                      {p.brand && <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{p.brand}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-[var(--text-dim)] text-xs font-medium">{fmt(p.sellPrice)} ₽</p>
                      {p.fullPrice > p.sellPrice && <p className="text-[var(--text-muted)] text-[10px] line-through">{fmt(p.fullPrice)} ₽</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[var(--text-muted)] text-xs">{fmt(p.feedbacks)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-semibold" style={{ color: '#cb11ab' }}>{fmtRevenue(p.revenue, '₽')}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-[var(--text-dim)] text-xs">{p.rating ? p.rating.toFixed(1) : '—'}</span>
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

// ─── Main client component ────────────────────────────────────────────────────

type SortUzum = 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC'
type SortYandex = 'OPINIONS' | 'PRICE' | 'QUALITY'
type SortWb = 'popular' | 'priceup' | 'pricedown' | 'rate'

interface Props {
  marketplace:       'uzum' | 'yandex' | 'wildberries'
  initialCategories: UzumPublicCategory[]
  userCategories:    string[]
  initialQuery?:     string
}

export default function MarketClient({ marketplace, initialCategories, userCategories, initialQuery }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].market
  const [selectedCat,  setSelectedCat]  = useState<{ id: number; title: string } | null>(null)
  const [uzumProducts, setUzumProducts] = useState<UzumPublicProduct[]>([])
  const [wbProducts,   setWbProducts]   = useState<WbPublicProduct[]>([])
  const [yandexCats,   setYandexCats]   = useState<{ id: number; name: string }[]>([])
  const [yandexModels, setYandexModels] = useState<YandexModel[]>([])
  const [total,        setTotal]        = useState(0)
  const [searchQuery,  setSearchQuery]  = useState(initialQuery ?? '')
  const [sortUzum,     setSortUzum]     = useState<SortUzum>('ORDER_COUNT_DESC')
  const [sortYandex,   setSortYandex]   = useState<SortYandex>('OPINIONS')
  const [sortWb,       setSortWb]       = useState<SortWb>('popular')
  const [mode,         setMode]         = useState<'category' | 'search'>('category')
  const [catsLoaded,   setCatsLoaded]   = useState(false)
  const [isPending,    startTransition] = useTransition()
  const didAutoSearch  = useRef(false)

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
      try {
        const params = new URLSearchParams({ page: '0', size: '40', sort: s, showAdultContent: 'true' })
        const res = await fetch(`https://api.uzum.uz/api/category/${cat.id}/products?${params}`, {
          headers: { 'Accept': 'application/json', 'Accept-Language': 'uz' },
        })
        if (res.ok) {
          const data = await res.json() as { payload?: { products?: UzumPublicProduct[]; total?: number; totalElements?: number }; products?: UzumPublicProduct[]; total?: number }
          const payload = data.payload ?? data
          setUzumProducts(payload.products ?? [])
          setTotal((payload as { total?: number; totalElements?: number }).total ?? (payload as { totalElements?: number }).totalElements ?? 0)
        }
      } catch { /* network error */ }
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

  const handleSearch = useCallback((sw: SortWb = sortWb, su: SortUzum = sortUzum, query = searchQuery) => {
    if (!query.trim()) return
    if (marketplace === 'uzum') {
      setMode('search'); setSelectedCat(null)
      startTransition(async () => {
        try {
          const params = new URLSearchParams({ text: query, size: '40', sort: su, showAdultContent: 'true' })
          const res = await fetch(`https://api.uzum.uz/api/v2/search/products?${params}`, {
            headers: { 'Accept': 'application/json', 'Accept-Language': 'uz' },
          })
          if (res.ok) {
            const data = await res.json() as { payload?: { products?: UzumPublicProduct[]; total?: number; totalElements?: number }; products?: UzumPublicProduct[]; total?: number }
            const payload = data.payload ?? data
            setUzumProducts(payload.products ?? [])
            setTotal((payload as { total?: number; totalElements?: number }).total ?? (payload as { totalElements?: number }).totalElements ?? 0)
          }
        } catch { /* network error */ }
      })
    } else if (marketplace === 'wildberries') {
      setMode('search'); setSelectedCat(null)
      startTransition(async () => {
        try {
          const params = new URLSearchParams({ appType: '1', curr: 'rub', dest: '-1257786', query, resultset: 'catalog', sort: sw, spp: '30' })
          const res = await fetch(`https://search.wb.ru/exactmatch/ru/common/v5/search?${params}`, {
            headers: { 'Accept': 'application/json' },
          })
          if (res.ok) {
            const data = await res.json() as { data?: { products?: unknown[] }; products?: unknown[] }
            const raw = (data.data?.products ?? data.products ?? []) as Array<{
              id: number; name?: string; brand?: string; reviewRating?: number; rating?: number
              feedbacks?: number; supplierId?: number
              salePriceU?: number; priceU?: number
              sizes?: { price?: { product?: number; basic?: number } }[]
            }>
            const products: WbPublicProduct[] = raw.slice(0, 40).map(p => {
              const sizePrice = p.sizes?.[0]?.price
              const sellPrice = sizePrice?.product ? Math.round(sizePrice.product / 100)
                : p.salePriceU ? Math.round(p.salePriceU / 100) : 0
              const fullPrice = sizePrice?.basic ? Math.round(sizePrice.basic / 100)
                : p.priceU ? Math.round(p.priceU / 100) : 0
              return { id: p.id, name: p.name ?? '', brand: p.brand ?? '', sellPrice, fullPrice, rating: p.reviewRating ?? p.rating ?? 0, feedbacks: p.feedbacks ?? 0, supplierId: p.supplierId }
            })
            setWbProducts(products); setTotal(products.length)
          }
        } catch { /* network error */ }
      })
    }
  }, [searchQuery, sortUzum, sortWb, marketplace])

  // Auto-search when opened from extension
  useEffect(() => {
    if (didAutoSearch.current || !initialQuery?.trim()) return
    didAutoSearch.current = true
    handleSearch(sortWb, sortUzum, initialQuery)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const WB_SORTS: { value: SortWb; label: string }[] = [
    { value: 'popular',   label: t.sortOrders    },
    { value: 'priceup',   label: t.sortPriceAsc  },
    { value: 'pricedown', label: t.sortPriceDesc },
    { value: 'rate',      label: t.sortRating    },
  ]

  const accent: string = marketplace === 'yandex' ? '#f59e0b' : marketplace === 'wildberries' ? '#cb11ab' : 'var(--c1)'
  const accentActiveStyle = {
    background: `color-mix(in srgb, ${accent} 16%, transparent)`,
    color: accent,
    border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
  }
  const cats          = marketplace === 'uzum' ? initialCategories : marketplace === 'yandex' ? yandexCats : []
  const showSearch    = marketplace === 'uzum' || marketplace === 'wildberries'
  const showCategories = marketplace === 'uzum' || marketplace === 'yandex'

  const hasResults = marketplace === 'uzum'
    ? uzumProducts.length > 0
    : marketplace === 'wildberries'
      ? wbProducts.length > 0
      : yandexModels.length > 0

  return (
    <div className="space-y-6">
      {/* Search — Uzum & Wildberries */}
      {showSearch && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={t.searchPlaceholder}
              className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
            />
          </div>
          <button onClick={() => handleSearch()}
            className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:brightness-110 flex items-center gap-2"
            style={{ background: accent }}>
            {isPending && mode === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t.search}
          </button>
        </div>
      )}

      {/* Category grid — Uzum & Yandex */}
      {showCategories && (
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
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all bg-[var(--bg-card2)] border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text-base)]"
                    style={active ? accentActiveStyle : undefined}
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
      )}

      {/* Results header */}
      {hasResults && !isPending && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--text-base)] font-semibold text-sm">
              {mode === 'category' ? selectedCat?.title : `"${searchQuery}" ${t.resultsSuffix}`}
            </p>
            {(marketplace === 'uzum' || marketplace === 'wildberries') && (
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{fmt(total)} {t.productsCount}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            {marketplace === 'uzum' && (
              <select value={sortUzum}
                onChange={e => {
                  const s = e.target.value as SortUzum; setSortUzum(s)
                  if (selectedCat) loadUzumCategory(selectedCat, s)
                  else if (mode === 'search') handleSearch(sortWb, s)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-dim)] text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {UZUM_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {marketplace === 'yandex' && (
              <select value={sortYandex}
                onChange={e => {
                  const s = e.target.value as SortYandex; setSortYandex(s)
                  if (selectedCat) loadYandexCategory({ id: selectedCat.id, name: selectedCat.title }, s)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-dim)] text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {YANDEX_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {marketplace === 'wildberries' && (
              <select value={sortWb}
                onChange={e => {
                  const s = e.target.value as SortWb; setSortWb(s)
                  handleSearch(s, sortUzum)
                }}
                className="bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-dim)] text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                {WB_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {isPending && (selectedCat || mode === 'search') && (
        <div className="flex items-center justify-center py-12 gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} />
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
      {!isPending && marketplace === 'wildberries' && wbProducts.length > 0 && (
        <WbProductTable products={wbProducts} t={t} />
      )}

      {/* Empty */}
      {!isPending && !hasResults && (selectedCat || mode === 'search') && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-[var(--text-dim)]" />
          {t.notFound}
        </div>
      )}
    </div>
  )
}
