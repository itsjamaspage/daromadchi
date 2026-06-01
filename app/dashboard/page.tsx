import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw, Megaphone, BarChart2 } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateFilter from '@/components/dashboard/DateFilter'
import SyncButton from '@/components/dashboard/SyncButton'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import DynamicsChart from '@/components/dashboard/DynamicsChart'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { adCampaigns, dynamicsData, productAds } from '@/lib/mock-data'
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

const VALID_MARKETPLACES = ['uzum', 'yandex_market'] as const

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

  const statusMap: Record<string, { label: string; className: string }> = {
    pending:   { label: d.status.pending,   className: 'bg-slate-500/10 text-slate-400' },
    confirmed: { label: d.status.confirmed, className: 'bg-blue-500/10 text-blue-400' },
    delivered: { label: d.status.delivered, className: 'bg-emerald-500/10 text-emerald-400' },
    cancelled: { label: d.status.cancelledShort, className: 'bg-red-500/10 text-red-400' },
    returned:  { label: d.status.returned,  className: 'bg-amber-500/10 text-amber-400' },
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
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-white">{d.nav.dashboard}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
              {d.yourData}
            </span>
          </div>
          <p className="text-slate-400 text-sm">{d.welcome}</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <Suspense>
            <DateFilter current={daysStr} />
          </Suspense>
        </div>
      </div>

      {/* Marketplace tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#13131f] border border-white/[0.06] rounded-xl w-fit">
        {([
          { label: d.all,           mp: undefined,          color: 'violet' },
          { label: 'Uzum',          mp: 'uzum',             color: 'violet' },
          { label: 'Yandex Market', mp: 'yandex_market',    color: 'amber'  },
        ] as { label: string; mp: string | undefined; color: string }[]).map(({ label, mp, color }) => {
          const active = (marketplace ?? undefined) === mp
          return (
            <Link
              key={label}
              href={mp ? `/dashboard?mp=${mp}&days=${daysStr}` : `/dashboard?days=${daysStr}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? color === 'amber'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Empty state — no data yet */}
      {isEmpty && (
        <div className="bg-[#13131f] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">{d.noDataYet}</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            {d.noDataDesc}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
              <Settings className="w-4 h-4" /> {d.goToSettings}
            </Link>
            <Link href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium px-5 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition-all">
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

      {/* Ad KPI summary */}
      {!isEmpty && (() => {
        const totalAdSpend = Object.values(productAds).reduce((s, a) => s + a.adSpend, 0)
        const totalRevenue = allProducts.reduce((s, p) => s + Number(p.selling_price ?? 0) * (p.sold ?? 0), 0)
        const drr = totalRevenue > 0 ? ((totalAdSpend / totalRevenue) * 100).toFixed(1) : '—'
        const totalClicks = Object.values(productAds).reduce((s, a) => s + a.clicks, 0)
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard title={d.adSpend} value={formatSum(totalAdSpend)} change={undefined} icon={Megaphone} color="violet" />
            <KpiCard title="DRR" value={`${drr}%`} change={undefined} icon={BarChart2} color="amber" />
            <KpiCard title={d.totalClicks} value={totalClicks.toLocaleString('uz-UZ')} change={undefined} icon={TrendingUp} color="blue" />
          </div>
        )
      })()}

      {/* Stock alerts — shown when relevant */}
      <StockAlerts products={allProducts} />

      {/* Chart + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart data={chartData} days={days} />
        </div>
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{d.recentOrders}</h3>
          <div className="space-y-3">
            {recentOrders.map(order => {
              const s = statusMap[order.status]
              return (
                <div key={order.id} className="flex items-start gap-3 pb-3 border-b border-white/[0.04] last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShoppingBag className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate font-mono">{order.order_id_external ?? order.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500 truncate">{order.marketplace === 'uzum' ? 'Uzum Market' : 'Yandex Market'}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${s.className}`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Dynamics chart */}
      {!isEmpty && <DynamicsChart data={dynamicsData} />}

      {/* Category chart + top products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CategoryChart data={categoryData} />

        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">{d.topProducts}</h3>
            <a href="/dashboard/products" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              {d.viewAll} &rarr;
            </a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.04]">
                <th className="text-left font-medium pb-3 pr-4">{d.product}</th>
                <th className="text-right font-medium pb-3 pr-4">{d.profit}</th>
                <th className="text-right font-medium pb-3">{d.sold}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {allProducts.slice(0, 5).map(p => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <p className="text-white font-medium text-xs">{p.title}</p>
                    <p className="text-slate-500 text-xs">{p.sku}</p>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-emerald-400 font-medium text-xs">{formatSum(p.profit)}</span>
                  </td>
                  <td className="py-3 text-right text-slate-300 text-xs">{p.sold ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links to new sections */}
      {!isEmpty && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/advertising',    icon: '📢', label: d.advertisingTitle,       sub: `${adCampaigns.filter(c=>c.status==='active').length} ${d.activeCampaigns}` },
            { href: '/dashboard/search-phrases', icon: '🔍', label: d.searchPhrasesTitle,     sub: d.trafficSource },
            { href: '/dashboard/unit-economics', icon: '📊', label: d.unitEcoTitle,            sub: d.costAnalysis },
            { href: '/dashboard/data-state',     icon: '🗂️', label: d.dataStateTitle,         sub: d.syncStatus },
          ].map(({ href, icon, label, sub }) => (
            <Link key={href} href={href}
              className="bg-[#13131f] border border-white/[0.06] hover:border-violet-500/30 rounded-2xl p-4 flex items-center gap-3 transition-all group">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-white text-xs font-semibold group-hover:text-violet-300 transition-colors">{label}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
