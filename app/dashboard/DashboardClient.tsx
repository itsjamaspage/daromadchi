'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw, LayoutDashboard } from 'lucide-react'
import KpiCard, { type KpiBreakdownRow } from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import LastSynced from '@/components/dashboard/LastSynced'
import SyncAlert from '@/components/dashboard/SyncAlert'
import DataErrorBanner from '@/components/dashboard/DataErrorBanner'
import NewDataToast from '@/components/dashboard/NewDataToast'
import { sellerOrderUrl } from '@/components/dashboard/OrdersTable'
import { useSyncPolling } from '@/hooks/useSyncPolling'
import { useLang, useTheme } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import { formatSum } from '@/lib/format-sum'
import { profitTier } from '@/lib/money/profit-presentation'
import type { Kpis, Order, Product, DailyRevenue, MarketplaceType } from '@/lib/types'
import { orderDisplayStatus } from '@/lib/marketplace/order-display-status'
import type { ProductSalesRow } from '@/lib/db/products'
import type { StockGroup } from '@/lib/db/stock-groups'
import { colorMetaFor, COLOR_LABELS, type ColorKey } from '@/lib/products/resolveColor'

// formatSum lives in lib/format-sum.ts so the KPI cards and the category
// breakdown share one currency formatter and can't drift apart.

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

// A Top-products row that merges several colours of one model (M9 black + white)
// must not borrow one child's colour label. This neutral marker names the group
// instead: a swatch per colour + a plain count, so the combined units read as
// the MODEL's total, not one variant's. Abbreviated count avoids Russian plural
// agreement ("2 цвета" vs "5 цветов") — "N цв." is correct at any number.
const COLORS_LABEL: Record<'uz' | 'ru' | 'en', (n: number) => string> = {
  uz: n => `${n} rang`,
  ru: n => `${n} цв.`,
  en: n => `${n} colors`,
}

function VariantGroupChip({ colors, lang }: { colors: string[]; lang: 'uz' | 'ru' | 'en' }) {
  const dots = colors.map(c => colorMetaFor(c)).filter((m): m is NonNullable<typeof m> => m != null).slice(0, 4)
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
      <span className="inline-flex items-center gap-0.5">
        {dots.map((m, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: m.hex, boxShadow: m.ring ? 'inset 0 0 0 1px var(--border)' : undefined }} />
        ))}
      </span>
      {COLORS_LABEL[lang](colors.length)}
    </span>
  )
}

interface CategoryData {
  name: string
  name_ru?: string
  name_uz?: string
  name_en?: string
  revenue: number
  /** NULL when part of the category has no cost price — see getCategoryRevenue. */
  profit: number | null
  percent: number
}

// The panels fetchSlice() loads independently. A name here appears in
// `failed` when that panel's query threw, which is NOT the same as it
// returning nothing — see app/dashboard/page.tsx.
// What a KPI card shows when its query failed. Deliberately not '0': a zero is
// an answer, and we do not have one.
const UNKNOWN = '—'

export type PanelKey = 'kpis' | 'orders' | 'products' | 'productSales' | 'chart' | 'categories'

export interface MarketplaceSlice {
  kpis: Kpis
  recentOrders: Order[]
  allProducts: Product[]
  productSales: ProductSalesRow[]
  chartData: DailyRevenue[]
  categoryData: CategoryData[]
  hasConnectedShop: boolean
  // Panels whose query failed. Their value above is a fallback, not an answer.
  failed: PanelKey[]
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
  const { kpis, recentOrders, allProducts, productSales, chartData, categoryData, hasConnectedShop, failed } =
    slices[sliceKey as keyof typeof slices]
  const failedPanels = failed ?? []
  const kpisFailed = failedPanels.includes('kpis')

  // A failed query is not an empty week. Without this, a thrown getKpis falls
  // back to zeroes and the page renders the "nothing here yet" state, which
  // tells the seller something the data does not support.
  const isEmpty = !kpisFailed && kpis.total_orders === 0 && allProducts.length === 0

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

  // The revenue card carries the SAME counted/pending split as the profit card,
  // in money. Общая выручка shows all delivered sales (315k); the profit under
  // it rests on the counted subset (200k). Without this line a reader pairs 25.5k
  // against 315k and reads an 8% margin that doesn't exist — so the revenue card
  // states its own basis: "Учтено: 200 000 · Ожидает расчёта: 115 000".
  const pendingRevenue = (kpis.pending_marketplaces ?? []).reduce((s, p) => s + p.revenue, 0)
  const countedRevenue = kpis.profit_revenue_counted ?? 0
  const revenueCoverageLine = pendingRevenue > 0
    ? `${t.kpi.counted}: ${formatSum(countedRevenue)} · ${t.kpi.awaiting}: ${formatSum(pendingRevenue)}`
    : undefined

  // Profit card, tiered by how much of the COUNTED revenue is uncosted. The
  // boundary maths (40% material, 100% suppress) lives in a tested pure helper —
  // see lib/money/profit-presentation.ts for why a profit with missing cost is
  // an upper bound, not a fact.
  const missingRev = kpis.cost_missing_revenue ?? 0
  const tier = profitTier({ countedRevenue, costMissingRevenue: missingRev })

  const profitBreakdown: KpiBreakdownRow[] = [
    { label: t.kpi.sales, value: formatSum(countedRevenue) },
    { label: t.kpi.cogs,  value: formatSum(kpis.profit_cogs ?? 0), kind: 'minus' },
    { label: t.kpi.fees,  value: formatSum(kpis.profit_fees ?? 0), kind: 'minus' },
    { label: t.kpi.net,   value: formatSum(kpis.total_profit),     kind: 'total' },
  ]

  let profitValue: string
  let profitBreakdownProp: KpiBreakdownRow[] | undefined
  let profitWarning: string | undefined
  let profitChange: number | null | undefined
  if (isEmpty || kpisFailed) {
    profitValue = kpisFailed ? UNKNOWN : formatSum(kpis.total_profit)
    profitBreakdownProp = undefined
    profitWarning = undefined
    profitChange = null
  } else if (countedRevenue === 0) {
    // Nothing counted → the coverage line carries the whole story.
    profitValue = formatSum(kpis.total_profit)
    profitBreakdownProp = undefined
    profitWarning = undefined
    profitChange = kpis.change_profit
  } else if (tier.kind === 'suppressed') {
    // 100% uncosted: the number would be revenue − commission wearing a net
    // label. Suppress it — a % vs prior on a non-number is meaningless too.
    profitValue = t.kpi.netUnknown
    profitBreakdownProp = undefined
    profitWarning = t.kpi.costNoneCta
    profitChange = null
  } else if (tier.kind === 'bounded') {
    profitValue = `≤ ${formatSum(kpis.total_profit)}`
    profitBreakdownProp = profitBreakdown
    profitWarning = t.kpi.costPartial
    profitChange = kpis.change_profit
  } else {
    profitValue = formatSum(kpis.total_profit)
    profitBreakdownProp = profitBreakdown
    // Gate on counted-scope missing revenue, not the all-delivered product
    // count: an uncosted product only on a pending (Yandex) order must not fire
    // "profit overstated" about a profit it isn't part of.
    profitWarning = tier.warnMissingCost
      ? t.kpi.noCost.replace('{n}', String(kpis.missing_cost_products ?? 0))
      : undefined
    profitChange = kpis.change_profit
  }


  // Top products: collapse listings that are really ONE product into a single
  // line with combined delivered units + revenue. Two rows merge when they
  // share a normalised SKU (the same article cross-listed on two marketplaces,
  // e.g. "JMJ16BG" on Uzum + Yandex) OR a variant_group_key (different-colour
  // variants of one model, e.g. M9 black "JMBLK" + M9 white "JMWHT" under one
  // parent). This mirrors the Analytics "Top sold" collapse; the SKU bridge
  // additionally covers rows that carry no variant_group_key. Rows with neither
  // key stay individual. Sorted by revenue so it's actually "top", capped at 5.
  const topProducts = useMemo(() => {
    type Row = { key: string; title: string; sku: string | null; variant_color: string | null; qty: number; revenue: number; marketplaces: Set<MarketplaceType>; colors: string[] }
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

    // Aggregate each component; the highest-revenue member names the row. We
    // also collect the DISTINCT colours the group spans: a row that merges M9
    // black + M9 white must not be labelled with one child's colour ("Белый")
    // as if that variant sold the whole quantity — see the multi-colour marker
    // in the render. colorSet holds resolved colour keys; a cross-listing of the
    // SAME colour on two marketplaces stays single-colour and keeps its chip.
    const byRoot = new Map<number, Row & { repRevenue: number; colorSet: Set<string> }>()
    productSales.forEach((p, i) => {
      const r = find(i)
      const ex = byRoot.get(r)
      if (!ex) {
        byRoot.set(r, { key: `grp:${r}`, title: p.title, sku: p.sku, variant_color: p.variant_color, qty: p.qty_sold, revenue: p.revenue, marketplaces: new Set(p.marketplace ? [p.marketplace] : []), colors: [], colorSet: new Set(p.variant_color ? [p.variant_color] : []), repRevenue: p.revenue })
      } else {
        ex.qty += p.qty_sold
        ex.revenue += p.revenue
        if (p.marketplace) ex.marketplaces.add(p.marketplace)
        if (p.variant_color) ex.colorSet.add(p.variant_color)
        if (p.revenue > ex.repRevenue) { ex.repRevenue = p.revenue; ex.title = p.title; ex.sku = p.sku; ex.variant_color = p.variant_color }
      }
    })
    return [...byRoot.values()]
      .map((r): Row => ({ key: r.key, title: r.title, sku: r.sku, variant_color: r.variant_color, qty: r.qty, revenue: r.revenue, marketplaces: r.marketplaces, colors: [...r.colorSet] }))
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

      {/* Above the fold, and above the KPI cards it explains. */}
      {failedPanels.length > 0 && <DataErrorBanner panels={failedPanels} />}

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
          <KpiCard title={d.revenue} value={kpisFailed ? UNKNOWN : formatSum(kpis.total_revenue)} change={isEmpty || kpisFailed ? null : kpis.change_revenue} icon={DollarSign}  color="violet"
            coverage={isEmpty || kpisFailed ? undefined : revenueCoverageLine}
          />
          {/* Profit shows its working, and only as far as it can. The breakdown
              adds up the COUNTED sales, not every sale in the period: the revenue
              card next door is where total sales live, and money a marketplace
              has not reported yet is named in the coverage line rather than
              folded in. When cost is missing on a material share of those counted
              sales, the headline stops asserting a net figure — see the tiering
              built above (profitValue / profitWarning). */}
          <KpiCard title={d.profit}  value={profitValue} change={profitChange}  icon={TrendingUp}  color="emerald"
            breakdown={profitBreakdownProp}
            warning={profitWarning}
            coverage={isEmpty || kpisFailed ? undefined : coverageLine}
          />
          <KpiCard title={d.orders}
            value={kpisFailed ? UNKNOWN : (kpis.total_orders - (kpis.cancelled_orders ?? 0)).toLocaleString('uz-UZ')}
            note={!kpisFailed && (kpis.cancelled_orders ?? 0) > 0
              ? `+${kpis.cancelled_orders} ${t.status.cancelled.toLowerCase()}${(kpis.cancelled_units ?? 0) > 0 ? ` (${kpis.cancelled_units} ${lang === 'ru' ? 'шт' : lang === 'en' ? 'pcs' : 'dona'})` : ''}`
              : undefined}
            change={isEmpty || kpisFailed ? null : kpis.change_orders} icon={ShoppingBag} color="blue" />
          <KpiCard title={d.stock}   value={kpisFailed ? UNKNOWN : kpis.total_stock.toLocaleString('uz-UZ')} change={isEmpty ? null : undefined}           icon={Package}     color="amber" />
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
                          {p.colors.length > 1 ? null : p.sku}
                          {[...p.marketplaces].map(mp => <MarketplaceBadge key={mp} marketplace={mp} />)}
                          {p.colors.length > 1
                            ? <VariantGroupChip colors={p.colors} lang={lang} />
                            : <VariantColorChip colorKey={p.variant_color} lang={lang} />}
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
