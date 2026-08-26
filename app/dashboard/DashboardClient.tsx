'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw, LayoutDashboard } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import LastSynced from '@/components/dashboard/LastSynced'
import SyncAlert from '@/components/dashboard/SyncAlert'
import NewDataToast from '@/components/dashboard/NewDataToast'
import { sellerOrderUrl } from '@/components/dashboard/OrdersTable'
import { useSyncPolling } from '@/hooks/useSyncPolling'
import { useLang, useTheme } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { Kpis, Order, Product, DailyRevenue, MarketplaceType } from '@/lib/types'
import { orderDisplayStatus } from '@/lib/marketplace/order-display-status'
import type { ProductSalesRow } from '@/lib/db/products'
import type { StockGroup } from '@/lib/db/stock-groups'
import { colorMetaFor, COLOR_LABELS, type ColorKey } from '@/lib/products/resolveColor'

function formatSum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + " mln so'm"
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '')     + " ming so'm"
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

// Short marketplace badge for the Top-products list: UZ (Uzum) / YM (Yandex
// Market). Colour-coded so a store is recognisable at a glance without
// reading the letters.
const MP_BADGE: Record<MarketplaceType, { label: string; cls: string }> = {
  uzum:          { label: 'UZ', cls: 'bg-violet-500/15 text-violet-500 border border-violet-500/30' },
  yandex_market: { label: 'YM', cls: 'bg-amber-500/15 text-amber-600 border border-amber-500/30' },
}
function MarketplaceBadge({ marketplace }: { marketplace?: MarketplaceType | null }) {
  if (!marketplace) return null
  const b = MP_BADGE[marketplace]
  if (!b) return null
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${b.cls}`}>
      {b.label}
    </span>
  )
}

// Colour swatch + label for a Top-products row (e.g. "● Чёрный"), shown next to
// the marketplace badges so colour variants of one model are told apart at a
// glance. Same chip the Analytics / Остатки tables use. Renders nothing when the
// product has no resolved colour.
function VariantColorChip({ colorKey, lang }: { colorKey: string | null | undefined; lang: 'uz' | 'ru' | 'en' }) {
  const meta = colorMetaFor(colorKey)
  if (!meta || !colorKey) return null
  const name = COLOR_LABELS[colorKey as ColorKey]?.[lang] ?? colorKey
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
      <span className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: meta.hex, boxShadow: meta.ring ? 'inset 0 0 0 1px var(--border)' : undefined }} />
      {name}
    </span>
  )
}

interface CategoryData {
  name: string
  name_ru?: string
  name_uz?: string
  name_en?: string
  revenue: number
  profit: number
  percent: number
}

export interface MarketplaceSlice {
  kpis: Kpis
  recentOrders: Order[]
  allProducts: Product[]
  productSales: ProductSalesRow[]
  chartData: DailyRevenue[]
  categoryData: CategoryData[]
  hasConnectedShop: boolean
}

interface Props {
  slices: {
    all: MarketplaceSlice
    uzum: MarketplaceSlice
    yandex_market: MarketplaceSlice
  }
  stockGroups: StockGroup[]
  days: number
  period: string
  from?: string
  to?: string
  initialMarketplace: MarketplaceType | undefined
  hasShops: boolean
  syncInfo: { lastSyncedAt: string | null; lastSyncFailed: boolean; alerts: { shopName: string; status: 'error' | 'degraded'; message: string | null; syncedAt: string | null }[] }
}

// Keyed by DISPLAY status — see lib/marketplace/order-display-status.ts.
const STATUS_CLASS_DARK: Record<string, string> = {
  pending:   'bg-slate-500/10 text-[var(--text-muted)]',
  preparing: 'bg-amber-500/10 text-amber-400',
  shipping:  'bg-blue-500/10 text-blue-400',
  delivered: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
  returned:  'bg-amber-500/10 text-amber-400',
}
const STATUS_CLASS_LIGHT: Record<string, string> = {
  pending:   'bg-slate-500/10 text-slate-600',
  preparing: 'bg-amber-500/10 text-amber-700',
  shipping:  'bg-blue-500/10 text-blue-700',
  delivered: 'bg-emerald-500/10 text-emerald-700',
  cancelled: 'bg-red-500/10 text-red-600',
  returned:  'bg-amber-500/10 text-amber-700',
}

export default function DashboardClient({ slices, stockGroups, days, period, from, to, initialMarketplace, syncInfo, }: Props) {
  const { lang } = useLang()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = dashT[lang]
  const d = t.dashboard
  const s = t.status

  const router = useRouter()

  const [marketplace, setMarketplace] = useState<MarketplaceType | undefined>(initialMarketplace)
  const { hasNewData, refresh: dismissNewData } = useSyncPolling(syncInfo.lastSyncedAt)

  function handleRefresh() {
    dismissNewData()
    router.refresh()
  }

  function switchTab(mp: MarketplaceType | undefined) {
    setMarketplace(mp)
    // Preserve the active range across a marketplace switch — a custom/default
    // from–to window (e.g. the current-week default) would otherwise be lost.
    const p = new URLSearchParams()
    if (mp) p.set('mp', mp)
    if (from && to) { p.set('from', from); p.set('to', to) }
    else if (period) p.set('days', period)
    const qs = p.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false })
  }

  const sliceKey = marketplace ?? 'all'
  const { kpis, recentOrders, allProducts, productSales, chartData, categoryData, hasConnectedShop } =
    slices[sliceKey as keyof typeof slices]

  const isEmpty = kpis.total_orders === 0 && allProducts.length === 0

  // "Учтено: Uzum · Ожидает расчёта: Yandex Market (115 ming so'm)". Names the
  // marketplaces behind the profit and the ones whose money has not landed, so
  // a figure smaller than the revenue beside it explains itself.
  const mpName = (mp: string) => ({ uzum: 'Uzum', yandex_market: 'Yandex Market' } as Record<string, string>)[mp] ?? mp
  const coverageParts: string[] = []
  if ((kpis.counted_marketplaces ?? []).length > 0) {
    coverageParts.push(`${t.kpi.counted}: ${(kpis.counted_marketplaces ?? []).map(mpName).join(', ')}`)
  }
  for (const p of kpis.pending_marketplaces ?? []) {
    coverageParts.push(`${t.kpi.awaiting}: ${mpName(p.marketplace)} (${formatSum(p.revenue)})`)
  }
  const coverageLine = coverageParts.length > 0 ? coverageParts.join(' · ') : undefined


  // Top products: collapse listings that are really ONE product into a single
  // line with combined delivered units + revenue. Two rows merge when they
  // share a normalised SKU (the same article cross-listed on two marketplaces,
  // e.g. "JMJ16BG" on Uzum + Yandex) OR a variant_group_key (different-colour
  // variants of one model, e.g. M9 black "JMBLK" + M9 white "JMWHT" under one
  // parent). This mirrors the Analytics "Top sold" collapse; the SKU bridge
  // additionally covers rows that carry no variant_group_key. Rows with neither
  // key stay individual. Sorted by revenue so it's actually "top", capped at 5.
  const topProducts = useMemo(() => {
    type Row = { key: string; title: string; sku: string | null; variant_color: string | null; qty: number; revenue: number; marketplaces: Set<MarketplaceType> }
    const norm = (s: string | null) => { const t = s?.trim().toLowerCase(); return t && t.length ? t : null }

    // Union-find over row indices: union any two rows sharing a SKU or a group.
    const parent = productSales.map((_, i) => i)
    const find = (x: number): number => { let r = x; while (parent[r] !== r) r = parent[r]; parent[x] = r; return r }
    const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
    const firstBySku = new Map<string, number>()
    const firstByVgk = new Map<string, number>()
    productSales.forEach((p, i) => {
      const nk = norm(p.sku)
      if (nk) { const j = firstBySku.get(nk); if (j === undefined) firstBySku.set(nk, i); else union(i, j) }
      if (p.variant_group_key) { const j = firstByVgk.get(p.variant_group_key); if (j === undefined) firstByVgk.set(p.variant_group_key, i); else union(i, j) }
    })

    // Aggregate each component; the highest-revenue member names the row.
    const byRoot = new Map<number, Row & { repRevenue: number }>()
    productSales.forEach((p, i) => {
      const r = find(i)
      const ex = byRoot.get(r)
      if (!ex) {
        byRoot.set(r, { key: `grp:${r}`, title: p.title, sku: p.sku, variant_color: p.variant_color, qty: p.qty_sold, revenue: p.revenue, marketplaces: new Set(p.marketplace ? [p.marketplace] : []), repRevenue: p.revenue })
      } else {
        ex.qty += p.qty_sold
        ex.revenue += p.revenue
        if (p.marketplace) ex.marketplaces.add(p.marketplace)
        if (p.revenue > ex.repRevenue) { ex.repRevenue = p.revenue; ex.title = p.title; ex.sku = p.sku; ex.variant_color = p.variant_color }
      }
    })
    return [...byRoot.values()]
      .map((r): Row => ({ key: r.key, title: r.title, sku: r.sku, variant_color: r.variant_color, qty: r.qty, revenue: r.revenue, marketplaces: r.marketplaces }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [productSales])

  type WidgetId = 'kpis' | 'alerts' | 'chart' | 'categories'

  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetId>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem('dashboard-hidden-widgets')
      return saved ? new Set(JSON.parse(saved) as WidgetId[]) : new Set()
    } catch { return new Set() }
  })
  const [showCustomize, setShowCustomize] = useState(false)

  function toggleWidget(id: WidgetId) {
    setHiddenWidgets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('dashboard-hidden-widgets', JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.title}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--c1)' }}>
              {d.badge}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LastSynced lastSyncedAt={syncInfo.lastSyncedAt} lastSyncFailed={syncInfo.lastSyncFailed} />
          <Suspense>
            {/* Chips off: the dashboard uses the current-week default + the ‹ ›
                week arrows + a custom from–to range. No preset chips. */}
            <DateRangePicker period={period} from={from} to={to} presets={[]} />
          </Suspense>
          <button
            onClick={() => setShowCustomize(v => !v)}
            className={`hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
              showCustomize
                ? 'border border-[var(--border)] text-[var(--c1)]'
                : 'bg-[var(--bg-input)] border-[var(--border2)] text-[var(--text-muted)] hover:text-[var(--text-base)]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            {d.customize ?? 'Customize'}
          </button>
        </div>
      </div>

      {/* Sync alert banner */}
      {syncInfo.alerts.length > 0 && <SyncAlert alerts={syncInfo.alerts} />}

      {/* Marketplace tabs — client-side switching, no page reload */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { label: d.all,           mp: undefined,       color: 'blue'  },
          { label: 'Uzum',          mp: 'uzum',          color: 'blue'  },
          { label: 'Yandex Market', mp: 'yandex_market', color: 'amber' },
        ] as { label: string; mp: MarketplaceType | undefined; color: string }[]).map(({ label, mp, color }) => {
          const active = marketplace === mp
          return (
            <button
              key={label}
              onClick={() => switchTab(mp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? color === 'amber'
                    ? isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                    : 'border border-[var(--border)] text-[var(--c1)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
              }`}
              style={active && color !== 'amber' ? { background: 'var(--bg-card2)' } : {}}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[var(--text-base)] font-semibold text-sm mb-3">{d.customize ?? 'Customize widgets'}</p>
          <div className="flex flex-wrap gap-3">
            {([
              { id: 'kpis',       label: d.widgetKpis       ?? 'KPI Cards'       },
              { id: 'alerts',     label: d.widgetAlerts     ?? 'Stock Alerts'    },
              { id: 'chart',      label: d.widgetChart      ?? 'Revenue Chart'   },
              { id: 'categories', label: d.widgetCategories ?? 'Categories'      },
            ] as { id: WidgetId; label: string }[]).map(({ id, label }) => {
              const visible = !hiddenWidgets.has(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleWidget(id)}
                  className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    visible
                      ? 'border-[var(--border)] text-[var(--c1)]'
                      : 'bg-[var(--bg-card2)] border-[var(--border2)] text-[var(--text-muted)]'
                  }`}
                  style={visible ? { background: 'var(--bg-card2)' } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: visible ? 'var(--c1)' : '#475569' }} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (() => {
        const mpLinks: Record<string, { url: string; label: string }> = {
          uzum:          { url: 'https://seller.uzum.uz',           label: 'seller.uzum.uz'           },
          yandex_market: { url: 'https://partner.market.yandex.ru', label: 'partner.market.yandex.ru' },
        }
        const mpKeys = ['uzum', 'yandex_market'] as const
        // On a specific tab show only that marketplace; on "Все" show all connected ones
        const linksToShow: { url: string; label: string }[] = marketplace
          ? [mpLinks[marketplace]].filter(Boolean)
          : mpKeys
              .filter(mp => slices[mp].hasConnectedShop)
              .map(mp => mpLinks[mp])
        // Fallback: if no connected shops yet, show all enabled marketplaces
        const fallbackLinks = Object.values(mpLinks)
        const displayLinks = linksToShow.length > 0 ? linksToShow : fallbackLinks

        if (hasConnectedShop) {
          return (
            <div className="bg-[var(--bg-card2)] border border-dashed border-amber-500/30 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">{d.noDataSynced ?? d.noData}</h2>
              <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">{d.noDataSyncedDesc ?? d.noDataDesc}</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {displayLinks.map(link => (
                  <Link key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-base)] text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--border2)] hover:bg-[var(--bg-card2)] transition-all">
                    {link.label} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          )
        }
        // Marketplace-specific not-connected card
        if (marketplace) {
          const mpName = ({ uzum: 'Uzum Market', yandex_market: 'Yandex Market' } as Record<string, string>)[marketplace]
          const mpLink = displayLinks[0]
          return (
            <div className="bg-[var(--bg-card2)] border border-dashed rounded-2xl p-10" style={{  borderColor: 'var(--border)' }}>
              <div className="max-w-md mx-auto text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                  <Settings className="w-7 h-7" style={{ color: 'var(--c1)' }} />
                </div>
                <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">{d.mpNotConnected.replace('{mp}', mpName)}</h2>
                <p className="text-[var(--text-muted)] text-sm mb-6">{d.mpConnectDesc}</p>
                <div className="grid grid-cols-2 gap-3 mb-8 text-left max-w-xs mx-auto">
                  {([
                    [DollarSign,  d.featureRevenue],
                    [ShoppingBag, d.featureOrders],
                    [TrendingUp,  d.featureSales],
                    [Package,     d.featureStock],
                  ] as [React.ElementType, string][]).map(([Icon, label]) => (
                    <div key={label} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c1)' }} />
                      {label}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link href="/dashboard/settings"
                    className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors" style={{ boxShadow: 'none' }}>
                    <Settings className="w-4 h-4" /> {d.connectMp.replace('{mp}', mpName)}
                  </Link>
                  {mpLink && (
                    <Link href={mpLink.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl border transition-all" style={{ color: 'var(--text-muted)', borderColor: 'var(--border2)' }}>
                      {mpLink.label} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        }

        return (
          <div className="bg-[var(--bg-card2)] border border-dashed rounded-2xl p-10 text-center" style={{  borderColor: 'var(--border)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <RefreshCw className="w-7 h-7" style={{ color: 'var(--c1)' }} />
            </div>
            <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">{d.noData}</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">{d.noDataDesc}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard/settings"
                className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg" style={{ boxShadow: 'none' }}>
                <Settings className="w-4 h-4" /> {d.goSettings}
              </Link>
              {displayLinks.map(link => (
                <Link key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-base)] text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--border2)] hover:bg-[var(--bg-card2)] transition-all">
                  {link.label} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {/* KPI cards */}
      {!hiddenWidgets.has('kpis') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard title={d.revenue} value={formatSum(kpis.total_revenue)}             change={isEmpty ? null : kpis.change_revenue} icon={DollarSign}  color="violet" />
          {/* Profit shows its working. 40 000 next to 200 000 of sales reads as a
              bug until the 130 000 of stock and 30 000 of fees are visible — so
              the card sets out the arithmetic instead of asserting a total.
              The breakdown adds up the COUNTED sales, not every sale in the
              period: the revenue card next door is where total sales live, and
              money a marketplace has not reported yet is named in the coverage
              line rather than folded in. Nothing counted → no arithmetic worth
              showing, and that line carries the whole story. */}
          <KpiCard title={d.profit}  value={formatSum(kpis.total_profit)}              change={isEmpty ? null : kpis.change_profit}  icon={TrendingUp}  color="emerald"
            breakdown={isEmpty || (kpis.profit_revenue_counted ?? 0) === 0 ? undefined : [
              { label: t.kpi.sales, value: formatSum(kpis.profit_revenue_counted ?? 0) },
              { label: t.kpi.cogs,  value: formatSum(kpis.profit_cogs ?? 0), kind: 'minus' },
              { label: t.kpi.fees,  value: formatSum(kpis.profit_fees ?? 0), kind: 'minus' },
              { label: t.kpi.net,   value: formatSum(kpis.total_profit),     kind: 'total' },
            ]}
            warning={(kpis.missing_cost_products ?? 0) > 0
              ? t.kpi.noCost.replace('{n}', String(kpis.missing_cost_products ?? 0))
              : undefined}
            coverage={isEmpty ? undefined : coverageLine}
          />
          <KpiCard title={d.orders}
            value={(kpis.total_orders - (kpis.cancelled_orders ?? 0)).toLocaleString('uz-UZ')}
            note={(kpis.cancelled_orders ?? 0) > 0
              ? `+${kpis.cancelled_orders} ${t.status.cancelled.toLowerCase()}${(kpis.cancelled_units ?? 0) > 0 ? ` (${kpis.cancelled_units} ${lang === 'ru' ? 'шт' : lang === 'en' ? 'pcs' : 'dona'})` : ''}`
              : undefined}
            change={isEmpty ? null : kpis.change_orders} icon={ShoppingBag} color="blue" />
          <KpiCard title={d.stock}   value={kpis.total_stock.toLocaleString('uz-UZ')}  change={isEmpty ? null : undefined}           icon={Package}     color="amber" />
        </div>
      )}

      {/* Stock alerts moved to the dedicated /dashboard/stocks page —
          keeping the same widget on the dashboard was noisy and
          redundant. Users go to the sidebar "Остатки" link when they
          want that view. */}

      {/* Chart + recent orders */}
      {!hiddenWidgets.has('chart') && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <RevenueChart data={chartData} days={days} />
          </div>
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-base)] font-semibold">{d.recentOrders}</h3>
              <Link href="/dashboard/orders" className="text-xs transition-colors" style={{ color: 'var(--c1)' }}>
                {d.viewAll} &rarr;
              </Link>
            </div>
            <div className="space-y-3 flex-1">
              {recentOrders.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">{d.noProducts ?? 'No orders found'}</p>
              ) : recentOrders.map(order => (
                <div key={order.id} className="flex items-start gap-3 pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--bg-card2)' }}>
                    <ShoppingBag className="w-4 h-4" style={{ color: 'var(--c1)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const url = sellerOrderUrl(order.marketplace, order.order_id_external, { shopIdExternal: order.shop_id_external, businessId: order.business_id })
                      return url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-[var(--text-base)] font-medium truncate font-mono hover:underline block">
                          {order.order_id_external} ↗
                        </a>
                      ) : (
                        <p className="text-sm text-[var(--text-base)] font-medium truncate font-mono">{order.order_id_external ?? order.id.slice(0, 8)}</p>
                      )
                    })()}
                    <p className="text-xs text-[var(--text-muted)] truncate">{{ uzum: 'Uzum Market', yandex_market: 'Yandex Market' }[order.marketplace] ?? order.marketplace}</p>
                  </div>
                  {(() => {
                    const ds = orderDisplayStatus(order.status, order.marketplace_status)
                    return (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${(isDark ? STATUS_CLASS_DARK : STATUS_CLASS_LIGHT)[ds] ?? 'bg-slate-500/10 text-[var(--text-muted)]'}`}>
                        {s[ds as keyof typeof s] ?? order.status}
                      </span>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category chart + top products */}
      {!hiddenWidgets.has('categories') && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <CategoryChart data={categoryData} />
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-base)] font-semibold">{d.topProducts}</h3>
              <Link href="/dashboard/products" className="text-xs transition-colors" style={{ color: 'var(--c1)' }}>
                {d.viewAll} &rarr;
              </Link>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[280px]">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                  <th className="text-left font-medium pb-3 pr-4">{d.product}</th>
                  <th className="text-right font-medium pb-3 pr-4">{d.revenue ?? "Daromad"}</th>
                  <th className="text-right font-medium pb-3">{d.sold}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {productSales.length === 0 && allProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center">
                      <p className="text-[var(--text-muted)] text-xs">{d.noProducts}</p>
                      <p className="text-[var(--text-muted)] text-[10px] mt-1">{d.noProductsDesc}</p>
                    </td>
                  </tr>
                ) : productSales.length > 0
                  ? topProducts.map(p => (
                    <tr key={p.key} className="hover:bg-[var(--bg-card2)] transition-colors">
                      <td className="py-3 pr-4">
                        <p className="text-[var(--text-base)] font-medium text-xs">{p.title}</p>
                        <p className="text-[var(--text-muted)] text-xs flex items-center gap-1.5">
                          {p.sku}
                          {[...p.marketplaces].map(mp => <MarketplaceBadge key={mp} marketplace={mp} />)}
                          <VariantColorChip colorKey={p.variant_color} lang={lang} />
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`${isDark ? 'text-emerald-400' : 'text-emerald-700'} font-medium text-xs`}>{formatSum(p.revenue)}</span>
                      </td>
                      <td className="py-3 text-right text-[var(--text-dim)] text-xs">{p.qty}</td>
                    </tr>
                  ))
                  : [...allProducts].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 5).map(p => (
                    <tr key={p.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                      <td className="py-3 pr-4">
                        <p className="text-[var(--text-base)] font-medium text-xs">{p.title}</p>
                        <p className="text-[var(--text-muted)] text-xs flex items-center gap-1.5">
                          {p.sku}
                          <MarketplaceBadge marketplace={p.marketplace} />
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-emerald-400 font-medium text-xs">{formatSum(Number(p.selling_price ?? 0) * (p.sold ?? 0))}</span>
                      </td>
                      <td className="py-3 text-right text-[var(--text-dim)] text-xs">{p.sold ?? 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      <NewDataToast visible={hasNewData} onRefresh={handleRefresh} />
    </div>
  )
}
