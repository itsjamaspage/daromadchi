'use client'

import { useState, useMemo } from 'react'
import { Search, ShoppingCart } from 'lucide-react'
import ExportButton from './ExportButton'
import type { Order, OrderStatus } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

const statusConfig: Record<OrderStatus, { label: string; className: string; dot: string }> = {
  pending:   { label: 'Kutilmoqda',    className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',   dot: 'bg-slate-400'  },
  confirmed: { label: 'Tasdiqlandi',   className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',     dot: 'bg-blue-400'   },
  delivered: { label: 'Yetkazildi',    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', dot: 'bg-emerald-400' },
  cancelled: { label: 'Bekor qilindi', className: 'bg-red-500/10 text-red-400 border border-red-500/20',         dot: 'bg-red-400'    },
  returned:  { label: 'Qaytarildi',    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',   dot: 'bg-amber-400'  },
}

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Barchasi'    },
  { value: 'delivered', label: 'Yetkazildi'  },
  { value: 'confirmed', label: 'Tasdiqlandi' },
  { value: 'pending',   label: 'Kutilmoqda'  },
  { value: 'returned',  label: 'Qaytarildi'  },
  { value: 'cancelled', label: 'Bekor'       },
]

const marketplaceLabel: Record<string, string> = {
  uzum: 'Uzum',
  yandex_market: 'Yandex Market',
}

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const [query,  setQuery]  = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')

  const statusCounts = useMemo(() =>
    orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {} as Record<string, number>)
  , [orders])

  const filtered = useMemo(() => {
    let rows = [...orders]
    if (status !== 'all') rows = rows.filter(o => o.status === status)
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(o =>
        (o.order_id_external ?? '').toLowerCase().includes(q) ||
        o.marketplace.toLowerCase().includes(q)
      )
    }
    return rows
  }, [orders, status, query])

  const exportData = filtered.map(o => ({
    'Buyurtma ID': o.order_id_external ?? o.id,
    'Marketplace': marketplaceLabel[o.marketplace] ?? o.marketplace,
    'Sana': o.ordered_at,
    "Daromad (so'm)": o.revenue ?? 0,
    "Komissiya (so'm)": o.marketplace_fee ?? 0,
    "Yetkazish (so'm)": o.delivery_cost ?? 0,
    'Mahsulotlar': o.items_count,
    'Holat': statusConfig[o.status]?.label ?? o.status,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-[#13131f] border border-white/[0.06] rounded-xl p-1 w-fit flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              status === tab.value ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${status === tab.value ? 'bg-white/20' : 'bg-white/[0.06]'}`}>
                {statusCounts[tab.value] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buyurtma ID yoki marketplace..."
            className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
        </div>
        <ExportButton data={exportData} filename="buyurtmalar" />
      </div>

      <p className="text-slate-500 text-xs">{filtered.length} ta buyurtma</p>

      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Buyurtma ID</th>
                <th className="text-left font-medium px-5 py-3">Marketplace</th>
                <th className="text-left font-medium px-5 py-3">Sana</th>
                <th className="text-right font-medium px-5 py-3">Daromad</th>
                <th className="text-right font-medium px-5 py-3">Komissiya</th>
                <th className="text-right font-medium px-5 py-3">Mahsulotlar</th>
                <th className="text-center font-medium px-5 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 text-sm">Hech narsa topilmadi</td></tr>
              ) : filtered.map(order => {
                const s = statusConfig[order.status]
                return (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        <span className="text-violet-400 font-mono text-xs font-medium">{order.order_id_external ?? order.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-xs">{marketplaceLabel[order.marketplace] ?? order.marketplace}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{new Date(order.ordered_at).toLocaleDateString('uz-UZ')}</td>
                    <td className="px-5 py-4 text-right text-white font-semibold">{order.revenue != null ? fmt(order.revenue) : '—'}</td>
                    <td className="px-5 py-4 text-right text-red-400/70 text-xs">{order.marketplace_fee != null ? fmt(order.marketplace_fee) : '—'}</td>
                    <td className="px-5 py-4 text-right text-slate-300">{order.items_count}</td>
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
