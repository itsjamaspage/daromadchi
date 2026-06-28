'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw, LayoutDashboard } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import SyncButton from '@/components/dashboard/SyncButton'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import { useLang, useTheme } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { Kpis, Order, Product, DailyRevenue, MarketplaceType } from '@/lib/types'

function formatSum(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

interface CategoryData {
  name: string
  revenue: number
  profit: number
  percent: number
}

export interface MarketplaceSlice {
  kpis: Kpis
  recentOrders: Order[]
  allProducts: Product[]
  chartData: DailyRevenue[]
  categoryData: CategoryData[]
  hasConnectedShop: boolean
}

interface Props {
  slices: {
    all: MarketplaceSlice
    uzum: MarketplaceSlice
    yandex_market: MarketplaceSlice
    wildberries: MarketplaceSlice
  }
  days: number
  period: string
  from?: string
  to?: string
  initialMarketplace: MarketplaceType | undefined
  hasShops: boolean
}

const STATUS_CLASS: Record<string, string> = {
  pending:   'bg-slate-500/10 text-[var(--text-muted)]',
  confirmed: 'bg-blue-500/10 text-blue-400',
  delivered: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
  returned:  'bg-amber-500/10 text-amber-400',
}

export default function DashboardClient({ slices, days, period, from, to, initialMarketplace, hasShops }: Props) {
  const { lang } = useLang()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = dashT[lang]
  const d = t.dashboard
  const s = t.status
  const router = useRouter()

  const [marketplace, setMarketplace] = useState<MarketplaceType | undefined>(initialMarketplace)

  function switchTab(mp: MarketplaceType | undefined) {
    setMarketplace(mp)
    const url = mp ? `/dashboard?mp=${mp}&days=${period}` : `/dashboard?days=${period}`
    router.replace(url, { scroll: false })
  }

  const sliceKey = marketplace ?? 'all'
  const { kpis, recentOrders, allProducts, chartData, categoryData, hasConnectedShop } =
    slices[sliceKey as keyof typeof slices]

  const isEmpty = kpis.total_orders === 0 && allProducts.length === 0

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
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(131,192,249,0.15)', border: '1px solid rgba(131,192,249,0.3)', color: 'var(--c1)' }}>
              {d.badge}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <Suspense>
            <DateRangePicker period={period} from={from} to={to} />
          </Suspense>
          <button
            onClick={() => setShowCustomize(v => !v)}
            className={`hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
              showCustomize
                ? 'border border-[rgba(131,192,249,0.3)] text-[var(--c1)]'
                : 'bg-[var(--bg-input)] border-[var(--border2)] text-[var(--text-muted)] hover:text-[var(--text-base)]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            {d.customize ?? 'Customize'}
          </button>
        </div>
      </div>

      {/* Marketplace tabs — client-side switching, no page reload */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { label: d.all,           mp: undefined,       color: 'blue'  },
          { label: 'Uzum',          mp: 'uzum',          color: 'blue'  },
          { label: 'Yandex Market', mp: 'yandex_market', color: 'amber' },
          { label: 'Wildberries',   mp: 'wildberries',   color: 'blue'  },
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
                    : 'border border-[rgba(131,192,249,0.3)] text-[var(--c1)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
              }`}
              style={active && color !== 'amber' ? { background: 'rgba(131,192,249,0.15)' } : {}}
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
                      ? 'border-[rgba(131,192,249,0.3)] text-[var(--c1)]'
                      : 'bg-[var(--bg-card2)] border-[var(--border2)] text-[var(--text-muted)]'
                  }`}
                  style={visible ? { background: 'rgba(131,192,249,0.12)' } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: visible ? '#83c0f9' : '#475569' }} />
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
          wildberries:   { url: 'https://seller.wildberries.ru',    label: 'seller.wildberries.ru'    },
        }
        // On a specific tab show only that marketplace; on "Все" show all connected ones
        const linksToShow: { url: string; label: string }[] = marketplace
          ? [mpLinks[marketplace]].filter(Boolean)
          : (['uzum', 'yandex_market', 'wildberries'] as const)
              .filter(mp => slices[mp].hasConnectedShop)
              .map(mp => mpLinks[mp])
        // Fallback: if no connected shops yet, show all three
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
        return (
          <div className="bg-[var(--bg-card2)] border border-dashed rounded-2xl p-10 text-center" style={{ borderColor: 'rgba(131,192,249,0.3)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(131,192,249,0.12)', border: '1px solid rgba(131,192,249,0.25)' }}>
              <RefreshCw className="w-7 h-7" style={{ color: '#83c0f9' }} />
            </div>
            <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">{d.noData}</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">{d.noDataDesc}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard/settings"
                className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg" style={{ boxShadow: '0 4px 14px rgba(131,192,249,0.2)' }}>
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
          <KpiCard title={d.profit}  value={formatSum(kpis.total_profit)}              change={isEmpty ? null : kpis.change_profit}  icon={TrendingUp}  color="emerald" />
          <KpiCard title={d.orders}  value={kpis.total_orders.toLocaleString('uz-UZ')} change={isEmpty ? null : kpis.change_orders}  icon={ShoppingBag} color="blue" />
          <KpiCard title={d.stock}   value={kpis.total_stock.toLocaleString('uz-UZ')}  change={isEmpty ? null : undefined}           icon={Package}     color="amber" />
        </div>
      )}

      {/* Stock alerts */}
      {!hiddenWidgets.has('alerts') && (
        <StockAlerts products={allProducts} />
      )}

      {/* Chart + recent orders */}
      {!hiddenWidgets.has('chart') && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <RevenueChart data={chartData} days={days} />
          </div>
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="text-[var(--text-base)] font-semibold mb-4">{d.recentOrders}</h3>
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-start gap-3 pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(131,192,249,0.12)' }}>
                    <ShoppingBag className="w-4 h-4" style={{ color: '#83c0f9' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-base)] font-medium truncate font-mono">{order.order_id_external ?? order.id.slice(0, 8)}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{{ uzum: 'Uzum Market', yandex_market: 'Yandex Market', wildberries: 'Wildberries' }[order.marketplace] ?? order.marketplace}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${STATUS_CLASS[order.status] ?? 'bg-slate-500/10 text-[var(--text-muted)]'}`}>
                    {s[order.status as keyof typeof s] ?? order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category chart + top products */}
      {!hiddenWidgets.has('categories') && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <CategoryChart data={categoryData} />
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-base)] font-semibold">{d.topProducts}</h3>
              <a href="/dashboard/products" className="text-xs transition-colors" style={{ color: 'var(--c1)' }}>
                {d.viewAll} &rarr;
              </a>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[280px]">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                  <th className="text-left font-medium pb-3 pr-4">{d.product}</th>
                  <th className="text-right font-medium pb-3 pr-4">{d.profit2}</th>
                  <th className="text-right font-medium pb-3">{d.sold}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {allProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center">
                      <p className="text-[var(--text-muted)] text-xs">{d.noProducts}</p>
                      <p className="text-[var(--text-muted)] text-[10px] mt-1">{d.noProductsDesc}</p>
                    </td>
                  </tr>
                ) : [...allProducts].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 5).map(p => (
                  <tr key={p.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-[var(--text-base)] font-medium text-xs">{p.title}</p>
                      <p className="text-[var(--text-muted)] text-xs">{p.sku}</p>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-emerald-400 font-medium text-xs">{formatSum(p.profit)}</span>
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
    </div>
  )
}
