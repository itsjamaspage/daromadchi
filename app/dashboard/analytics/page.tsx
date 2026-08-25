/* eslint-disable react/no-unescaped-entities */
import { BarChart2, Settings, Package, Link2, RefreshCw, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { getProducts } from '@/lib/db/products'
import { getProductSales } from '@/lib/db/products'
import { getKpis } from '@/lib/db/kpis'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import AnalyticsProductTable from '@/components/dashboard/AnalyticsProductTable'
import { effective } from '@/lib/products/effective-values'
import PeriodSelector from './PeriodSelector'
import { getT, getLang } from '@/lib/server-i18n'
import { currentUserAccess } from '@/lib/billing/entitlement'
import FeatureLock from '@/components/dashboard/FeatureLock'
import type { MarketplaceType } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

// Cyrillic plural for "N variants" — same one Products page uses. Passed
// down to both grouped Analytics tables so the parent chip reads
// "2 варианта" not "2 вариантов".
const VALID_MP = ['uzum', 'yandex_market'] as const
function parseMp(v: string | undefined): MarketplaceType | undefined {
  return (VALID_MP as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

const VALID_DAYS = [30, 90, 180, 365, 730] as const
function parseDays(v: string | undefined): number | null {
  if (!v || v === 'all') return null          // default = all-time, no filter
  const n = Number(v)
  return (VALID_DAYS as readonly number[]).includes(n) ? n : null
}

function parseDate(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  // Gate BEFORE the queries: a locked page must not pay for data it will not
  // show, and nothing gated should reach the browser to be hidden with CSS.
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('analytics')])
  if (!access.allowed) return <FeatureLock lang={lang} feature="analytics" hadTrial={access.trialEnded} />

  const params = await searchParams
  const marketplace = parseMp(params.mp)
  const days = parseDays(params.days)
  const from = parseDate(params.from)
  const to   = parseDate(params.to)

  const [t, products, kpis, periodSales] = await Promise.all([
    getT(),
    getProducts(marketplace),
    getKpis(days ?? 0, marketplace, from ?? undefined, to ?? undefined),
    getProductSales(days, marketplace, from ?? undefined, to ?? undefined),
  ])
  const d = t.dashboard
  const hasProducts = products.length > 0
  const hasOrders = kpis.total_orders > 0
  const isEmpty = !hasProducts && !hasOrders

  // Analytics operates on distinct physical products (grouped by normalized
  // SKU), not per-marketplace listings. Otherwise the same 1 unit listed on
  // Uzum + YM shows up as "2 products" and its warehouse value is doubled.
  const norm = (s: string | null) => s ? s.trim().toLowerCase() : null
  const groupsMap = new Map<string, typeof products>()
  for (const p of products) {
    const key = norm(p.sku) ?? `#${p.id}`
    const list = groupsMap.get(key)
    if (list) list.push(p)
    else groupsMap.set(key, [p])
  }
  const productGroups = [...groupsMap.values()]
  // One representative per group for margin math (pick first with both price
  // and cost, else first with any price, else any).
  const repMembers = productGroups.map(g =>
    g.find(p => (p.selling_price ?? 0) > 0 && (p.cost_price ?? 0) > 0)
    ?? g.find(p => (p.selling_price ?? 0) > 0)
    ?? g[0])

  // Every card below reads through effective(), the same helper the table
  // rows use. Computing these off selling_price while the rows show a seller's
  // price override is how a page starts contradicting itself: "Avg margin
  // 95.9%" over rows that visibly say otherwise.
  const marginOf = (p: typeof products[number]) => {
    const { price, cost } = effective(p)
    return price > 0 ? (price - cost) / price : null
  }

  const margins = repMembers.map(marginOf)
  const avgMargin = margins.length > 0
    ? margins.reduce((s: number, m) => s + (m ?? 0), 0) / margins.length * 100
    : 0

  const lowMarginCount  = margins.filter(m => m !== null && m < 0.15).length
  const highMarginCount = margins.filter(m => m !== null && m >= 0.35).length


  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-base)' }}>
            <BarChart2 className="w-6 h-6" style={{ color: 'var(--c1)' }} />
            {d.analyticsTitle}
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{d.analyticsSubtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <MarketplaceTabs current={marketplace} />
        </Suspense>
        <Suspense>
          <PeriodSelector
            currentFrom={from}
            currentTo={to}
            labels={{
              label: d.periodLabel,
              apply: d.periodApply,
              clear: d.periodClear,
            }}
          />
        </Suspense>
      </div>

      {isEmpty ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(131, 192, 249, 0.1)', borderColor: 'rgba(131, 192, 249, 0.2)', color: 'var(--c1)' }}>
            <BarChart2 className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noAnalyticsData}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noAnalyticsDataDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors btn-primary">
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      ) : !hasProducts ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: d.totalOrders,      value: kpis.total_orders.toLocaleString(),           color: 'var(--c1)' },
              { label: d.totalRevenue,     value: `${fmt(kpis.total_revenue)} so'm`,             color: '#10b981' },
              { label: d.netProfit,        value: `${fmt(kpis.total_profit)} so'm`,              color: kpis.total_profit >= 0 ? '#10b981' : '#ef4444' },
              { label: d.stockInWarehouse, value: kpis.total_stock.toLocaleString(),             color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} className="border rounded-2xl p-5" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="border border-dashed rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <div className="w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b' }}>
              <RefreshCw className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-base)' }}>{d.ordersOnlyTitle}</h2>
            <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>{d.ordersOnlyDesc}</p>
            <Link href="/dashboard/sync"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              style={{ background: '#f59e0b', color: 'white' }}>
              <RefreshCw className="w-4 h-4" /> {d.goToSync}
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: d.totalProducts,  value: productGroups.length.toString(),  color: 'var(--c1)' },
              { label: d.avgMargin,      value: `${avgMargin.toFixed(1)}%`,  color: avgMargin >= 25 ? '#10b981' : '#f59e0b' },
              { label: d.lowMargin,      value: lowMarginCount.toString(),   color: lowMarginCount > 0 ? '#ef4444' : '#10b981' },
              { label: d.highMargin,     value: highMarginCount.toString(),  color: '#10b981' },
            ].map(({ label, value, color }) => (
              <div key={label} className="border rounded-2xl p-5" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sales AND margin in one table — variant-grouped over the whole
              catalogue, so a product that earns well but sold nothing this
              period is still visible instead of being filtered out. */}
          <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--c1)' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{d.productPerformanceTitle}</h2>
            </div>
            <AnalyticsProductTable
              products={products}
              sales={periodSales}
              labels={{
                product:             d.product,
                qty:                 d.topSoldQty,
                inTransit:           d.topSoldInTransit,
                cancelled:           d.topSoldCancelled,
                revenue:             d.topSoldRevenue,
                price:               d.price,
                costPrice:           d.costPrice,
                profit:              d.profit,
                margin:              d.margin,
                noSales:             d.noSalesInPeriod,
                setPrice:            d.setPriceLabel,
                setCost:             d.setCostLabel,
                editPriceHint:       d.editPriceHint,
                editCostHint:        d.editCostHint,
                mixedValues:         d.mixedValuesLabel,
                appliesToAll:        d.appliesToAllLabel,
                returned:            d.colReturned,
                returnRate:          d.colReturnRate,
                salesShare:          d.colSalesShare,
                avgPrice:            d.colAvgPrice,
                abc:                 d.colAbc,
              }}
            />
          </div>

          {/* Low-margin alerts */}
          {lowMarginCount > 0 && (
            <div className="space-y-2">
              {products
                .filter(p => { const m = marginOf(p); return m !== null && m < 0.15 })
                .map(p => (
                  <div key={p.id} className="flex items-center gap-3 border rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--alert-red-bg)', borderColor: 'var(--alert-red-border)' }}>
                    <Package className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--alert-red-icon)' }} />
                    <span className="font-medium" style={{ color: 'var(--alert-red-text)' }}>{p.title}</span>
                    <span style={{ color: 'var(--alert-red-muted)' }}>
                      — margin {((marginOf(p) ?? 0) * 100).toFixed(1)}% ({d.belowMarginNote}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Ad data notice */}
          <div className="flex items-start gap-3 border rounded-xl px-4 py-3 text-xs" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
            <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--c1)' }} />
            <span>
              <strong style={{ color: 'var(--c1)' }}>{d.adAnalyticsNote}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>{d.adAnalyticsNoteSuffix}</span>
            </span>
          </div>

        </>
      )}
    </div>
  )
}
