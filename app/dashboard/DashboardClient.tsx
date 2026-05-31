'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateFilter from '@/components/dashboard/DateFilter'
import SyncButton from '@/components/dashboard/SyncButton'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import { useLang } from '@/app/providers'
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

interface Props {
  kpis: Kpis
  recentOrders: Order[]
  allProducts: Product[]
  chartData: DailyRevenue[]
  categoryData: CategoryData[]
  days: number
  daysStr: string
  marketplace: MarketplaceType | undefined
}

const STATUS_CLASS: Record<string, string> = {
  pending:   'bg-slate-500/10 text-slate-400',
  confirmed: 'bg-blue-500/10 text-blue-400',
  delivered: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
  returned:  'bg-amber-500/10 text-amber-400',
}

export default function DashboardClient({ kpis, recentOrders, allProducts, chartData, categoryData, days, daysStr, marketplace }: Props) {
  const { lang } = useLang()
  const t = dashT[lang]
  const d = t.dashboard
  const s = t.status

  const isEmpty = kpis.total_orders === 0 && allProducts.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-white">{d.title}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
              {d.badge}
            </span>
          </div>
          <p className="text-slate-400 text-sm">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <Suspense>
            <DateFilter current={daysStr} />
          </Suspense>
        </div>
      </div>

      {/* Marketplace tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { label: d.all,           mp: undefined,       color: 'violet' },
          { label: 'Uzum',          mp: 'uzum',          color: 'violet' },
          { label: 'Yandex Market', mp: 'yandex_market', color: 'amber'  },
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

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">{d.noData}</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">{d.noDataDesc}</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
              <Settings className="w-4 h-4" /> {d.goSettings}
            </Link>
            <Link href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--border2)] hover:bg-white/[0.04] transition-all">
              seller.uzum.uz <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={d.revenue} value={formatSum(kpis.total_revenue)}             change={isEmpty ? null : undefined} icon={DollarSign}  color="violet" />
        <KpiCard title={d.profit}  value={formatSum(kpis.total_profit)}              change={isEmpty ? null : undefined} icon={TrendingUp}  color="emerald" />
        <KpiCard title={d.orders}  value={kpis.total_orders.toLocaleString('uz-UZ')} change={isEmpty ? null : undefined} icon={ShoppingBag} color="blue" />
        <KpiCard title={d.stock}   value={kpis.total_stock.toLocaleString('uz-UZ')}  change={isEmpty ? null : undefined} icon={Package}     color="amber" />
      </div>

      {/* Stock alerts */}
      <StockAlerts products={allProducts} />

      {/* Chart + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart data={chartData} days={days} />
        </div>
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{d.recentOrders}</h3>
          <div className="space-y-3">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-start gap-3 pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShoppingBag className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate font-mono">{order.order_id_external ?? order.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500 truncate">{order.marketplace === 'uzum' ? 'Uzum Market' : 'Yandex Market'}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${STATUS_CLASS[order.status] ?? 'bg-slate-500/10 text-slate-400'}`}>
                  {s[order.status as keyof typeof s] ?? order.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category chart + top products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CategoryChart data={categoryData} />
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">{d.topProducts}</h3>
            <a href="/dashboard/products" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              {d.viewAll} &rarr;
            </a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[var(--border)]">
                <th className="text-left font-medium pb-3 pr-4">{d.product}</th>
                <th className="text-right font-medium pb-3 pr-4">{d.profit2}</th>
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
    </div>
  )
}
