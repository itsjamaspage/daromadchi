import { DollarSign, TrendingUp, ShoppingBag, Package } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import { kpiData, orders, products } from '@/lib/mock-data'

function formatSum(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

const statusMap: Record<string, { label: string; className: string }> = {
  delivered: { label: 'Yetkazildi', className: 'bg-emerald-500/10 text-emerald-400' },
  processing: { label: 'Jarayonda', className: 'bg-amber-500/10 text-amber-400' },
  shipped: { label: 'Yuborildi', className: 'bg-blue-500/10 text-blue-400' },
  cancelled: { label: 'Bekor', className: 'bg-red-500/10 text-red-400' },
}

export default function DashboardPage() {
  const recentOrders = orders.slice(0, 5)
  const topProducts = products.slice(0, 4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Xush kelibsiz! Bu sizning analitika panelingiz.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Umumiy daromad"
          value={formatSum(kpiData.revenue.value)}
          change={kpiData.revenue.change}
          icon={DollarSign}
          color="violet"
        />
        <KpiCard
          title="Sof foyda"
          value={formatSum(kpiData.profit.value)}
          change={kpiData.profit.change}
          icon={TrendingUp}
          color="emerald"
        />
        <KpiCard
          title="Buyurtmalar"
          value={kpiData.orders.value.toLocaleString('uz-UZ')}
          change={kpiData.orders.change}
          icon={ShoppingBag}
          color="blue"
        />
        <KpiCard
          title="Ombordagi mahsulot"
          value={kpiData.stock.value.toLocaleString('uz-UZ')}
          change={kpiData.stock.change}
          icon={Package}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart />
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
                    <p className="text-sm text-white font-medium truncate">{order.customer}</p>
                    <p className="text-xs text-slate-500 truncate">{order.product}</p>
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

      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Top mahsulotlar</h3>
          <a href="/dashboard/products" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Hammasini ko&apos;rish &rarr;
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.04]">
                <th className="text-left font-medium pb-3 pr-6">Mahsulot</th>
                <th className="text-right font-medium pb-3 pr-6">Narx</th>
                <th className="text-right font-medium pb-3 pr-6">Foyda</th>
                <th className="text-right font-medium pb-3">Sotilgan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {topProducts.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-6">
                    <div>
                      <p className="text-white font-medium">{p.name}</p>
                      <p className="text-slate-500 text-xs">{p.sku}</p>
                    </div>
                  </td>
                  <td className="py-3 pr-6 text-right text-slate-300">
                    {formatSum(p.price)}
                  </td>
                  <td className="py-3 pr-6 text-right">
                    <span className="text-emerald-400 font-medium">{formatSum(p.profit)}</span>
                  </td>
                  <td className="py-3 text-right text-slate-300">{p.sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
