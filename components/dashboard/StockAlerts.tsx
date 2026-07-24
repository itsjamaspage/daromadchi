'use client'

import Link from 'next/link'
import { AlertTriangle, Package, TrendingDown } from 'lucide-react'
import FulfillmentBadge from './FulfillmentBadge'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { StockGroup } from '@/lib/db/stock-groups'
import type { MarketplaceType } from '@/lib/types'

const MP_META: Record<MarketplaceType, { short: string; color: string; bg: string }> = {
  uzum:          { short: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.12)'   },
  yandex_market: { short: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.12)'  },
  wildberries:   { short: 'WB', color: '#CB11AB', bg: 'rgba(203,17,171,0.12)' },
}
const MP_ORDER: MarketplaceType[] = ['uzum', 'yandex_market', 'wildberries']

// A group is "alerting" when leftover has dropped to (or below) its threshold,
// OR when the run-rate says fewer than 30 days of stock remain. Threshold
// defaults to 15 units when the group hasn't set its own via product_links.
const DEFAULT_THRESHOLD = 15
function isAlerting(g: StockGroup): boolean {
  const threshold = g.stock_threshold ?? DEFAULT_THRESHOLD
  if (g.leftover <= threshold) return true
  return g.days_of_stock !== null && g.days_of_stock <= 30
}

export default function StockAlerts({ groups, isDark }: { groups: StockGroup[]; isDark: boolean }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard.stocksPage
  const alerts = groups
    .filter(isAlerting)
    .sort((a, b) => a.leftover - b.leftover || (a.days_of_stock ?? 999) - (b.days_of_stock ?? 999))
    .slice(0, 10)

  if (alerts.length === 0) return null

  const amber = isDark ? '#f59e0b' : '#b45309'

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <AlertTriangle className="w-4 h-4" style={{ color: amber }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{d.title}</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-lg border" style={{ color: amber, background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(180,83,9,0.08)', borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(180,83,9,0.25)' }}>
          {alerts.length} {d.units}
        </span>
      </div>

      <div style={{ borderColor: 'var(--border)' }}>
        {alerts.map((g, idx) => {
          const urgent  = g.leftover === 0 || (g.days_of_stock !== null && g.days_of_stock <= 7)
          const warning = g.days_of_stock !== null && g.days_of_stock <= 14
          const urgentColor = urgent ? '#ef4444' : warning ? amber : 'var(--text-muted)'
          const bgColor = urgent ? 'rgba(239, 68, 68, 0.1)' : warning ? (isDark ? 'rgba(245,158,11,0.1)' : 'rgba(180,83,9,0.08)') : 'rgba(100,116,139,0.1)'
          const barColor = urgent ? '#ef4444' : warning ? amber : '#64748b'
          const sku = g.members[0]?.sku ?? '—'
          const mps = MP_ORDER.filter(mp => mp in g.stock_by_marketplace)

          return (
            <Link href="/dashboard/stocks" key={g.match_key}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:opacity-90"
              style={{ borderBottom: idx < alerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bgColor, color: urgentColor }}>
                {urgent ? <TrendingDown className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-base)' }}>{g.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sku}</span>
                  {mps.map(mp => {
                    const m = MP_META[mp]
                    const member = g.members.find(mem => mem.marketplace === mp)
                    return (
                      <span key={mp} className="inline-flex items-center gap-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: m.bg, color: m.color }}>
                          {m.short} {g.stock_by_marketplace[mp] ?? 0}
                        </span>
                        <FulfillmentBadge type={member?.fulfillment_type} />
                      </span>
                    )
                  })}
                  {g.days_of_stock !== null && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      · {g.days_of_stock} {d.days}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold" style={{ color: urgentColor }}>
                  {g.leftover} {d.units}
                </p>
              </div>

              <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: barColor }} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
