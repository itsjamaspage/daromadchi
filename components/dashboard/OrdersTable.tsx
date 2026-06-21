'use client'

import { useState, useMemo } from 'react'
import { Search, ShoppingCart } from 'lucide-react'
import ExportButton from './ExportButton'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Order, OrderStatus } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

const marketplaceLabel: Record<string, string> = {
  uzum: 'Uzum',
  yandex_market: 'Yandex Market',
  wildberries: 'Wildberries',
}

const MP_TABS = [
  { value: 'all',           label: 'Barchasi' },
  { value: 'uzum',          label: 'Uzum'          },
  { value: 'yandex_market', label: 'Yandex Market' },
  { value: 'wildberries',   label: 'Wildberries'   },
] as const
type MpFilter = typeof MP_TABS[number]['value']

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const s = d.status

  const statusConfig: Record<OrderStatus, { label: string; className: string; dot: string }> = {
    pending:   { label: s.pending,   className: 'bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border)]',       dot: 'bg-slate-400'   },
    confirmed: { label: s.confirmed, className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',          dot: 'bg-blue-400'    },
    delivered: { label: s.delivered, className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', dot: 'bg-emerald-400' },
    cancelled: { label: s.cancelled, className: 'bg-red-500/10 text-red-400 border border-red-500/20',             dot: 'bg-red-400'     },
    returned:  { label: s.returned,  className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',       dot: 'bg-amber-400'   },
  }

  const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
    { value: 'all',       label: s.all            },
    { value: 'delivered', label: s.delivered      },
    { value: 'confirmed', label: s.confirmed      },
    { value: 'pending',   label: s.pending        },
    { value: 'returned',  label: s.returned       },
    { value: 'cancelled', label: s.cancelledShort },
  ]

  const [query,  setQuery]  = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [mp,     setMp]     = useState<MpFilter>('all')

  const statusCounts = useMemo(() =>
    orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {} as Record<string, number>)
  , [orders])

  const filtered = useMemo(() => {
    let rows = [...orders]
    if (mp !== 'all') rows = rows.filter(o => o.marketplace === mp)
    if (status !== 'all') rows = rows.filter(o => o.status === status)
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(o =>
        (o.order_id_external ?? '').toLowerCase().includes(q) ||
        o.marketplace.toLowerCase().includes(q)
      )
    }
    return rows
  }, [orders, status, query, mp])

  const exportData = filtered.map(o => ({
    [d.orderId]: o.order_id_external ?? o.id,
    [d.marketplace]: marketplaceLabel[o.marketplace] ?? o.marketplace,
    [d.date]: o.ordered_at,
    [`${d.revenue} (so'm)`]: o.revenue ?? 0,
    [`${d.commission2} (so'm)`]: o.marketplace_fee ?? 0,
    [`${d.delivery} (so'm)`]: o.delivery_cost ?? 0,
    [d.items]: o.items_count,
    [d.state]: statusConfig[o.status]?.label ?? o.status,
  }))

  return (
    <div className="space-y-4">
      {/* Marketplace filter */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {MP_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setMp(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mp === tab.value
                ? 'text-[var(--c1)]'
                : 'text-[var(--text-base)] hover:text-[var(--c1)]'
            }`}
            style={mp === tab.value ? {
              background: 'rgba(131,192,249,0.15)',
              border: '1px solid rgba(131,192,249,0.25)',
            } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-1 w-fit flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              status === tab.value ? 'text-[var(--text-base)]' : 'text-[var(--text-base)] opacity-70 hover:opacity-100'
            }`}
            style={status === tab.value ? { background: 'var(--c1)' } : undefined}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${status === tab.value ? 'bg-white/20' : 'bg-[var(--bg-input)]'}`}>
                {statusCounts[tab.value] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={d.searchOrderPlaceholder}
            className="w-full bg-[var(--bg-card2)] border border-[var(--border2)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#83c0f9]/60 focus:ring-1 focus:ring-[#83c0f9]/30 transition-all"
          />
        </div>
        <ExportButton data={exportData} filename="buyurtmalar" />
      </div>

      <p className="text-[var(--text-muted)] text-xs">{filtered.length} {d.orderCount}</p>

      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left font-medium px-5 py-3">{d.orderId}</th>
                <th className="text-left font-medium px-5 py-3">{d.marketplace}</th>
                <th className="text-left font-medium px-5 py-3">{d.date}</th>
                <th className="text-right font-medium px-5 py-3">{d.revenue}</th>
                <th className="text-right font-medium px-5 py-3">{d.commission2}</th>
                <th className="text-right font-medium px-5 py-3">{d.items}</th>
                <th className="text-center font-medium px-5 py-3">{d.state}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-[var(--text-muted)] text-sm">{d.noOrdersTitle}</td></tr>
              ) : filtered.map(order => {
                const sc = statusConfig[order.status]
                return (
                  <tr key={order.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(131,192,249,0.12)' }}>
                          <ShoppingCart className="w-3.5 h-3.5" style={{ color: 'var(--c1)' }} />
                        </div>
                        <span className="font-mono text-xs font-medium" style={{ color: 'var(--c1)' }}>{order.order_id_external ?? order.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--text-dim)] text-xs">{marketplaceLabel[order.marketplace] ?? order.marketplace}</td>
                    <td className="px-5 py-4 text-[var(--text-muted)] text-xs">{new Date(order.ordered_at).toLocaleDateString('uz-UZ')}</td>
                    <td className="px-5 py-4 text-right text-[var(--text-base)] font-semibold">{order.revenue != null ? fmt(order.revenue) : '—'}</td>
                    <td className="px-5 py-4 text-right text-red-400/70 text-xs">{order.marketplace_fee != null ? fmt(order.marketplace_fee) : '—'}</td>
                    <td className="px-5 py-4 text-right text-[var(--text-dim)]">{order.items_count}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${sc.className}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
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
