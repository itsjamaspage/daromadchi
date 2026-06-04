import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateFilter from '@/components/dashboard/DateFilter'
import SyncButton from '@/components/dashboard/SyncButton'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import AnalyticsBoard from '@/components/dashboard/AnalyticsBoard'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getT } from '@/lib/server-i18n'

function formatSum(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

// statusMap is now built dynamically inside the component using translations

function parseDays(params: Record<string, string> | undefined): number {
  const v = params?.days
  return v === '7' || v === '90' ? Number(v) : 30
}

function buildCategoryData(products: Awaited<ReturnType<typeof getProducts>>) {
  const map: Record<string, { revenue: number; profit: number }> = {}
  for (const p of products) {
    const cat = p.category ?? 'Boshqa'
    const rev = Number(p.selling_price ?? 0) * (p.sold ?? 0)
    const pro = p.profit * (p.sold ?? 0)
    if (!map[cat]) map[cat] = { revenue: 0, profit: 0 }
    map[cat].revenue += rev
    map[cat].profit  += pro
  }
  const total = Object.values(map).reduce((s, v) => s + v.revenue, 0)
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v, percent: total > 0 ? (v.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

import type { MarketplaceType } from '@/lib/types'

const VALID_MARKETPLACES = ['uzum', 'yandex_market', 'wildberries'] as const

function parseMarketplace(params: Record<string, string> | undefined): MarketplaceType | undefined {
  const v = params?.mp
  return (VALID_MARKETPLACES as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params      = await searchParams
  const days        = parseDays(params)
  const daysStr     = String(days)
  const marketplace = parseMarketplace(params)
  const t = await getT()
  const d = t.dashboard

  const statusMap: Record<string, { label: string; bgColor: string; textColor: string }> = {
    pending:   { label: d.status.pending,   bgColor: 'rgba(100, 116, 139, 0.1)', textColor: '#64748b' },
    confirmed: { label: d.status.confirmed, bgColor: 'rgba(59, 130, 246, 0.1)', textColor: '#3b82f6' },
    delivered: { label: d.status.delivered, bgColor: 'rgba(52, 211, 153, 0.1)', textColor: '#10b981' },
    cancelled: { label: d.status.cancelledShort, bgColor: 'rgba(239, 68, 68, 0.1)', textColor: '#ef4444' },
    returned:  { label: d.status.returned,  bgColor: 'rgba(245, 158, 11, 0.1)', textColor: '#f59e0b' },
  }

  const [kpis, recentOrders, allProducts, chartData] = await Promise.all([
    getKpis(days, marketplace),
    getOrders(5,  marketplace),
    getProducts(  marketplace),
    getDailyRevenue(days, marketplace),
  ])

  const categoryData = buildCategoryData(allProducts)
  const isEmpty = kpis.total_orders === 0 && allProducts.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{d.nav.dashboard}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.25)', color: '#7c3aed' }}>
              {d.yourData}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{d.welcome}</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <Suspense>
            <DateFilter current={daysStr} />
          </Suspense>
        </div>
      </div>

      {/* Marketplace tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
        {([
          { label: d.all,           mp: undefined,          accent: 'var(--c1)' },
          { label: 'Uzum',          mp: 'uzum',             accent: 'var(--c1)' },
          { label: 'Yandex Market', mp: 'yandex_market',    accent: '#f59e0b'   },
          { label: 'Wildberries',   mp: 'wildberries',      accent: '#cb11ab'   },
        ] as { label: string; mp: string | undefined; accent: string }[]).map(({ label, mp, accent }) => {
          const active = (marketplace ?? undefined) === mp
          return (
            <Link
              key={label}
              href={mp ? `/dashboard?mp=${mp}&days=${daysStr}` : `/dashboard?days=${daysStr}`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
              style={active ? {
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                color: accent,
                borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
              } : {
                color: 'var(--text-muted)',
                borderColor: 'transparent',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Empty state — no data yet */}
      {isEmpty && (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <RefreshCw className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noDataYet}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noDataDesc}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              style={{ background: '#7c3aed', color: 'white' }}>
              <Settings className="w-4 h-4" /> {d.goToSettings}
            </Link>
            <Link href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl border transition-all"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              seller.uzum.uz <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={d.totalRevenue}     value={formatSum(kpis.total_revenue)}               change={isEmpty ? null : undefined} icon={DollarSign}  color="violet" />
        <KpiCard title={d.netProfit}        value={formatSum(kpis.total_profit)}                change={isEmpty ? null : undefined} icon={TrendingUp}  color="emerald" />
        <KpiCard title={d.totalOrders}      value={kpis.total_orders.toLocaleString('uz-UZ')}   change={isEmpty ? null : undefined} icon={ShoppingBag} color="blue" />
        <KpiCard title={d.stockInWarehouse} value={kpis.total_stock.toLocaleString('uz-UZ')}    change={isEmpty ? null : undefined} icon={Package}     color="amber" />
      </div>


      {/* Stock alerts — shown when relevant */}
      <StockAlerts products={allProducts} />

      {/* Chart + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart data={chartData} days={days} />
        </div>
        <div className="border rounded-2xl p-6" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-base)' }}>{d.recentOrders}</h3>
          <div className="space-y-3">
            {recentOrders.map(order => {
              const s = statusMap[order.status]
              return (
                <div key={order.id} className="flex items-start gap-3 pb-3 last:border-0 last:pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}>
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate font-mono" style={{ color: 'var(--text-base)' }}>{order.order_id_external ?? order.id.slice(0, 8)}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{({ uzum: 'Uzum Market', yandex_market: 'Yandex Market', wildberries: 'Wildberries' } as Record<string, string>)[order.marketplace] ?? order.marketplace}</p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: s.bgColor, color: s.textColor }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Analytics board — channel trends, customer mix, funnel, category bubbles */}
      {!isEmpty && (
        <AnalyticsBoard
          chartData={chartData}
          categoryData={categoryData}
          products={allProducts}
          kpis={kpis}
        />
      )}

      {/* Category chart + top products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CategoryChart data={categoryData} />

        <div className="border rounded-2xl p-6" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--text-base)' }}>{d.topProducts}</h3>
            <a href="/dashboard/products" className="text-xs transition-colors" style={{ color: '#7c3aed' }}>
              {d.viewAll} &rarr;
            </a>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[280px]">
            <thead>
              <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left font-medium pb-3 pr-4">{d.product}</th>
                <th className="text-right font-medium pb-3 pr-4">{d.profit}</th>
                <th className="text-right font-medium pb-3">{d.sold}</th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--border)' }}>
              {allProducts.slice(0, 5).map(p => (
                <tr key={p.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-xs" style={{ color: 'var(--text-base)' }}>{p.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</p>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="font-medium text-xs" style={{ color: '#10b981' }}>{formatSum(p.profit)}</span>
                  </td>
                  <td className="py-3 text-right text-xs" style={{ color: 'var(--text-dim)' }}>{p.sold ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Quick links to new sections */}
      {!isEmpty && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/advertising',    icon: '📢', label: d.advertisingTitle,       sub: d.activeCampaigns },
            { href: '/dashboard/search-phrases', icon: '🔍', label: d.searchPhrasesTitle,     sub: d.trafficSource },
            { href: '/dashboard/unit-economics', icon: '📊', label: d.unitEcoTitle,            sub: d.costAnalysis },
            { href: '/dashboard/data-state',     icon: '🗂️', label: d.dataStateTitle,         sub: d.syncStatus },
          ].map(({ href, icon, label, sub }) => (
            <Link key={href} href={href}
              className="bg-[var(--bg-card2)] border border-[var(--border)] hover:border-violet-500/30 rounded-2xl p-4 flex items-center gap-3 transition-all group">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-[var(--text-base)] text-xs font-semibold group-hover:text-violet-300 transition-colors">{label}</p>
                <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
