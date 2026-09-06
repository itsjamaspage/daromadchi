'use client'

import { useState, useMemo } from 'react'
import { ShoppingCart } from 'lucide-react'
import ExportButton from './ExportButton'
import FilterBar from './FilterBar'
import FulfillmentBadge from './FulfillmentBadge'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Order, OrderStatus } from '@/lib/types'
import { orderDisplayStatus, type OrderDisplayStatus } from '@/lib/marketplace/order-display-status'

function fmt(n: number, lang: string) {
  const suf = lang === 'ru' ? 'сум' : lang === 'en' ? 'UZS' : "so'm"
  return new Intl.NumberFormat('uz-UZ').format(n) + ' ' + suf
}

function relativeDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return lang === 'ru' ? 'Сегодня' : lang === 'en' ? 'Today' : 'Bugun'
  if (diffDays === 1) return lang === 'ru' ? 'Вчера' : lang === 'en' ? 'Yesterday' : 'Kecha'
  if (diffDays < 7) {
    const word = lang === 'ru' ? 'дн. назад' : lang === 'en' ? 'days ago' : 'kun oldin'
    return `${diffDays} ${word}`
  }
  return date.toLocaleDateString('uz-UZ')
}

const MP_META: Record<string, { short: string; color: string; bg: string }> = {
  uzum:          { short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
}

export function sellerOrderUrl(marketplace: string, extId: string | null, opts?: { shopIdExternal?: string | null; businessId?: string | null }): string | null {
  if (!extId) return null
  if (marketplace === 'uzum') return `https://seller.uzum.uz/seller/orders/fbs/${extId}`
  if (marketplace === 'yandex_market') {
    const biz = opts?.businessId
    const campaign = opts?.shopIdExternal
    if (biz && campaign) return `https://partner.market.yandex.ru/business/${biz}/orders?campaignId=${campaign}`
    return null
  }
  return null
}

const STATUS_GROUP: Record<OrderStatus, 'pending' | 'confirmed' | 'delivered' | 'cancelled'> = {
  pending: 'pending', confirmed: 'confirmed',
  delivered: 'delivered',
  cancelled: 'cancelled', returned: 'cancelled',
}
type StatusTab = 'all' | 'pending' | 'confirmed' | 'delivered' | 'cancelled'

const STATUS_DOT_COLOR: Record<string, string> = {
  pending: '#64748b',
  confirmed: '#f59e0b',
  delivered: '#10b981',
  cancelled: '#ef4444',
}

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const s = d.status

  const statusConfig: Record<OrderDisplayStatus, { label: string; className: string; dot: string }> = {
    pending:   { label: s.pending,   className: 'bg-slate-100 text-slate-600 border border-slate-300',         dot: 'bg-slate-500'   },
    preparing: { label: s.preparing, className: 'bg-amber-50 text-amber-700 border border-amber-200',          dot: 'bg-amber-500'   },
    shipping:  { label: s.shipping,  className: 'bg-blue-50 text-blue-600 border border-blue-200',             dot: 'bg-blue-500'    },
    delivered: { label: s.delivered, className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',    dot: 'bg-emerald-500' },
    cancelled: { label: s.cancelled, className: 'bg-red-50 text-red-600 border border-red-200',                dot: 'bg-red-500'     },
  }

  const STATUS_TABS: { value: StatusTab; label: string }[] = [
    { value: 'all',        label: s.all            },
    { value: 'pending',    label: s.pending        },
    { value: 'confirmed',  label: s.confirmed      },
    { value: 'delivered',  label: s.delivered      },
    { value: 'cancelled',  label: s.cancelledShort },
  ]

  const [query,  setQuery]  = useState('')
  const [status, setStatus] = useState<StatusTab>('all')

  const statusCounts = useMemo(() =>
    orders.reduce((acc, o) => {
      const g = STATUS_GROUP[o.status] ?? 'pending'
      acc[g] = (acc[g] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  , [orders])

  const filtered = useMemo(() => {
    let rows = [...orders]
    if (status !== 'all') rows = rows.filter(o => (STATUS_GROUP[o.status] ?? 'pending') === status)
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
    [d.orderId]: o.order_id_external ?? o.id,
    [d.marketplace]: MP_META[o.marketplace]?.short ?? o.marketplace,
    [d.date]: o.ordered_at,
    [`${d.revenue} (so'm)`]: o.revenue ?? 0,
    // An empty cell, not a zero: Yandex does not report a per-order fee until
    // its netting report lands, and a spreadsheet column of zeros sums to a
    // commission total that looks complete and is not.
    [`${d.commission2} (so'm)`]: o.marketplace_fee ?? '',
    [`${d.delivery} (so'm)`]: o.delivery_cost ?? '',
    [d.items]: o.items_count,
    [d.state]: statusConfig[orderDisplayStatus(o.status, o.marketplace_status)]?.label ?? o.status,
  }))

  return (
    <div className="space-y-4">
      {/* Status tabs — underline style with colored dots */}
      <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-6 border-b pb-0" style={{ borderColor: 'var(--border)' }}>
          {STATUS_TABS.map(t => {
            const isActive = status === t.value
            return (
              <button key={t.value} onClick={() => setStatus(t.value)}
                className="relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
                style={{ color: isActive ? 'var(--text-base)' : 'var(--text-muted)' }}>
                {t.value !== 'all' && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT_COLOR[t.value] }} />
                )}
                {t.label}
                {t.value !== 'all' && (
                  <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-md"
                    style={{ background: isActive ? 'rgba(128,128,128,0.08)' : 'transparent', color: 'var(--text-muted)' }}>
                    {statusCounts[t.value] ?? 0}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--c1)' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={d.searchOrderPlaceholder}
        lang={lang}
        actions={<ExportButton data={exportData} filename="buyurtmalar" />}
        resultCount={filtered.length}
        countLabel={d.orderCount}
      />

      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-card2)]">
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
                const sc = statusConfig[orderDisplayStatus(order.status, order.marketplace_status)]
                const fullDate = new Date(order.ordered_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
                return (
                  <tr key={order.id} className="hover:bg-[rgba(128,128,128,0.04)] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(73,79,223,0.08)' }}>
                          <ShoppingCart className="w-3.5 h-3.5" style={{ color: 'var(--c1)' }} />
                        </div>
                        {(() => {
                          const url = sellerOrderUrl(order.marketplace, order.order_id_external, { shopIdExternal: order.shop_id_external, businessId: order.business_id })
                          const label = order.order_id_external ?? order.id.slice(0, 8)
                          return url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-xs font-medium hover:underline"
                              style={{ color: 'var(--c1)' }}
                              title="Uzum seller kabinetida ochish">
                              {label} ↗
                            </a>
                          ) : (
                            <span className="font-mono text-xs font-medium" style={{ color: 'var(--c1)' }}>{label}</span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        {MP_META[order.marketplace] && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: MP_META[order.marketplace].bg, color: MP_META[order.marketplace].color }}>
                            {MP_META[order.marketplace].short}
                          </span>
                        )}
                        <FulfillmentBadge type={order.fulfillment_type} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-base)' }} title={fullDate}>
                      {relativeDate(order.ordered_at, lang)}
                    </td>
                    {/* Cancelled/returned orders show "—" — the seller never
                        received that money or paid that fee. */}
                    <td className="px-5 py-3 text-right text-sm tabular-nums font-medium" style={{ color: 'var(--text-base)' }}>
                      {STATUS_GROUP[order.status] === 'cancelled' ? '—' : (order.revenue != null ? fmt(order.revenue, lang) : '—')}
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                      {STATUS_GROUP[order.status] === 'cancelled' ? '—' : (order.marketplace_fee != null ? fmt(order.marketplace_fee, lang) : '—')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium" style={{ color: 'var(--text-base)' }}>{order.items_count}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.className}`}>
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
