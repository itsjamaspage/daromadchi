import { ShoppingCart, Filter } from 'lucide-react'
import { orders } from '@/lib/mock-data'

function formatSum(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  delivered: {
    label: 'Yetkazildi',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  processing: {
    label: 'Jarayonda',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  shipped: {
    label: 'Yuborildi',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-400',
  },
  cancelled: {
    label: 'Bekor qilindi',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  },
}

const statusCounts = orders.reduce((acc, o) => {
  acc[o.status] = (acc[o.status] || 0) + 1
  return acc
}, {} as Record<string, number>)

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Buyurtmalar</h1>
          <p className="text-slate-400 text-sm mt-1">{orders.length} ta buyurtma</p>
        </div>
        <button className="flex items-center gap-2 bg-[#13131f] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="bg-[#13131f] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-slate-400 text-xs">{cfg.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{statusCounts[key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Buyurtma ID</th>
                <th className="text-left font-medium px-5 py-3">Mijoz</th>
                <th className="text-left font-medium px-5 py-3">Mahsulot</th>
                <th className="text-left font-medium px-5 py-3">Sana</th>
                <th className="text-right font-medium px-5 py-3">Summa</th>
                <th className="text-center font-medium px-5 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {orders.map(order => {
                const s = statusConfig[order.status]
                return (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        <span className="text-violet-400 font-mono text-xs font-medium">{order.id}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-white font-medium">{order.customer}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300">{order.product}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-500 text-xs">{order.date}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-white font-semibold">{formatSum(order.amount)}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${s.className}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
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
