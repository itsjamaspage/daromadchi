import { Suspense } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, ShoppingBag, Package, Settings, ArrowRight, RefreshCw } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DateFilter from '@/components/dashboard/DateFilter'
import SyncButton from '@/components/dashboard/SyncButton'
import StockAlerts from '@/components/dashboard/StockAlerts'
import CategoryChart from '@/components/dashboard/CategoryChart'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'

function formatSum(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

const statusMap: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Kutilmoqda',  className: 'bg-slate-500/10 text-slate-400' },
  confirmed: { label: 'Tasdiqlandi', className: 'bg-blue-500/10 text-blue-400' },
  delivered: { label: 'Yetkazildi',  className: 'bg-emerald-500/10 text-emerald-400' },
  cancelled: { label: 'Bekor',       className: 'bg-red-500/10 text-red-400' },
  returned:  { label: 'Qaytarildi',  className: 'bg-amber-500/10 text-amber-400' },
}

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

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params  = await searchParams
  const days    = parseDays(params)
  const daysStr = String(days)

  const [kpis, recentOrders, allProducts, chartData] = await Promise.all([
    getKpis(days),
    getOrders(5),
    getProducts(),
    getDailyRevenue(days),
  ])

  const categoryData = buildCategoryData(allProducts)
  const isEmpty = kpis.total_orders === 0 && allProducts.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Xush kelibsiz! Bu sizning analitika panelingiz.</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <Suspense>
            <DateFilter current={daysStr} />
          </Suspense>
        </div>
      </div>

      {/* Empty state — no data yet */}
      {isEmpty && (
        <div className="bg-[#13131f] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Hali ma'lumot yo'q</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Do'koningizni ulash uchun Sozlamalar sahifasiga o'ting, Uzum API tokeningizni kiriting va sinxronizatsiyani boshlang.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
              <Settings className="w-4 h-4" /> Sozlamalarga o'tish
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
        <KpiCard title="Umumiy daromad"     value={formatSum(kpis.total_revenue)}               change={isEmpty ? null : undefined} icon={DollarSign}  color="violet" />
        <KpiCard title="Sof foyda"          value={formatSum(kpis.total_profit)}                change={isEmpty ? null : undefined} icon={TrendingUp}  color="emerald" />
        <KpiCard title="Buyurtmalar"        value={kpis.total_orders.toLocaleString('uz-UZ')}   change={isEmpty ? null : undefined} icon={ShoppingBag} color="blue" />
        <KpiCard title="Ombordagi mahsulot" value={kpis.total_stock.toLocaleString('uz-UZ')}    change={isEmpty ? null : undefined} icon={Package}     color="amber" />
      </div>

      {/* Stock alerts — shown when relevant */}
      <StockAlerts products={allProducts} />

      {/* Chart + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart data={chartData} days={days} />
        </div>
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">So&apos;nggi buyurtmalar</h3>
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

      {/* Category chart + top products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CategoryChart data={categoryData} />

        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Top mahsulotlar</h3>
            <a href="/dashboard/products" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              Hammasini ko&apos;rish &rarr;
            </a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.04]">
                <th className="text-left font-medium pb-3 pr-4">Mahsulot</th>
                <th className="text-right font-medium pb-3 pr-4">Foyda</th>
                <th className="text-right font-medium pb-3">Sotilgan</th>
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
