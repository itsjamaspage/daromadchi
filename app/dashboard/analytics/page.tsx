import { BarChart2, Settings, TrendingUp, Package, Link2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { getProducts } from '@/lib/db/products'
import { getKpis } from '@/lib/db/kpis'
import AdDrrChart from './AdDrrChart'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import { getT } from '@/lib/server-i18n'
import type { MarketplaceType } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

const VALID_MP = ['uzum', 'yandex_market', 'wildberries'] as const
function parseMp(v: string | undefined): MarketplaceType | undefined {
  return (VALID_MP as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams
  const marketplace = parseMp(params.mp)
  const [t, products, kpis] = await Promise.all([getT(), getProducts(marketplace), getKpis(30, marketplace)])
  const d = t.dashboard
  const hasProducts = products.length > 0
  const hasOrders = kpis.total_orders > 0
  const isEmpty = !hasProducts && !hasOrders

  const avgMargin = products.length > 0
    ? products.reduce((s, p) => {
        const price = Number(p.selling_price ?? 0)
        return s + (price > 0 ? p.profit / price : 0)
      }, 0) / products.length * 100
    : 0

  const lowMarginCount  = products.filter(p => {
    const price = Number(p.selling_price ?? 0)
    return price > 0 && (p.profit / price) < 0.15
  }).length

  const highMarginCount = products.filter(p => {
    const price = Number(p.selling_price ?? 0)
    return price > 0 && (p.profit / price) >= 0.35
  }).length

  const totalStockValue = products.reduce((s, p) =>
    s + Number(p.cost_price ?? 0) * p.stock_quantity, 0)

  const sortedByMargin = [...products].sort((a, b) => {
    const ma = Number(a.selling_price ?? 0) > 0 ? a.profit / Number(a.selling_price) : 0
    const mb = Number(b.selling_price ?? 0) > 0 ? b.profit / Number(b.selling_price) : 0
    return mb - ma
  })

  const chartRows = sortedByMargin.slice(0, 10).map(p => ({
    name: p.title,
    drrTotal: Number(p.selling_price ?? 0) > 0 ? (p.profit / Number(p.selling_price)) * 100 : 0,
    drrAd: 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-base)' }}>
            <BarChart2 className="w-6 h-6" style={{ color: '#7c3aed' }} />
            {d.analyticsTitle}
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{d.analyticsSubtitle}</p>
      </div>

      <Suspense>
        <MarketplaceTabs current={marketplace} />
      </Suspense>

      {isEmpty ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <BarChart2 className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noAnalyticsData}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noAnalyticsDataDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: '#7c3aed', color: 'white' }}>
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      ) : !hasProducts ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: d.totalOrders,      value: kpis.total_orders.toLocaleString(),           color: '#7c3aed' },
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
              { label: d.totalProducts,  value: products.length.toString(),  color: '#7c3aed' },
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

          {/* Low-margin alerts */}
          {lowMarginCount > 0 && (
            <div className="space-y-2">
              {products
                .filter(p => {
                  const price = Number(p.selling_price ?? 0)
                  return price > 0 && (p.profit / price) < 0.15
                })
                .map(p => (
                  <div key={p.id} className="flex items-center gap-3 border rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239, 68, 68, 0.07)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <Package className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
                    <span className="font-medium" style={{ color: 'rgba(239, 68, 68, 0.9)' }}>{p.title}</span>
                    <span style={{ color: 'rgba(239, 68, 68, 0.7)' }}>
                      — margin {((p.profit / Number(p.selling_price)) * 100).toFixed(1)}% ({d.belowMarginNote}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Top-10 margin chart */}
          <AdDrrChart rows={chartRows} />

          {/* Ad data notice */}
          <div className="flex items-start gap-3 border rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(59, 130, 246, 0.06)', borderColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--color-info)' }}>
            <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong style={{ color: 'rgba(59, 130, 246, 0.9)' }}>{d.adAnalyticsNote}</strong> {d.adAnalyticsNoteSuffix}
            </span>
          </div>

          {/* Full margin table */}
          <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{d.marginByProduct}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
                    <th className="text-left font-medium px-5 py-3">{d.product}</th>
                    <th className="text-right font-medium px-4 py-3">{d.price}</th>
                    <th className="text-right font-medium px-4 py-3">{d.costPrice}</th>
                    <th className="text-right font-medium px-4 py-3">{d.profit}</th>
                    <th className="text-right font-medium px-4 py-3">{d.margin}</th>
                    <th className="text-right font-medium px-4 py-3">{d.stockQty}</th>
                    <th className="text-right font-medium px-4 py-3">{d.stockValue}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByMargin.map((p, idx) => {
                    const price    = Number(p.selling_price ?? 0)
                    const cost     = Number(p.cost_price ?? 0)
                    const margin   = price > 0 ? (p.profit / price) * 100 : 0
                    const stockVal = cost * p.stock_quantity
                    const profitColor = p.profit > 0 ? '#10b981' : '#ef4444'
                    const marginColor = margin >= 35 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444'
                    return (
                      <tr key={p.id} style={{ borderBottom: idx < sortedByMargin.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium" style={{ color: 'var(--text-base)' }}>{p.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{fmt(price)} so'm</td>
                        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-muted)' }}>{cost > 0 ? `${fmt(cost)} so'm` : '—'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-semibold" style={{ color: profitColor }}>
                            {fmt(p.profit)} so'm
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-semibold" style={{ color: marginColor }}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-dim)' }}>{p.stock_quantity}</td>
                        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--text-muted)' }}>
                          {stockVal > 0 ? `${fmt(stockVal)} so'm` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderTop: '1px solid var(--border)' }}>
                    <td colSpan={6} className="px-5 py-4 font-bold text-xs uppercase tracking-wide" style={{ color: 'var(--text-base)' }}>
                      {d.warehouseValueTotal}
                    </td>
                    <td className="px-4 py-4 text-right font-bold" style={{ color: '#7c3aed' }}>{fmt(totalStockValue)} so'm</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
