import { FileText, Settings } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { getMonthlyPnl } from '@/lib/db/pnl'
import { getUserShops } from '@/lib/db/shop-context'
import PnlChart from './PnlChart'
import ExportButton from '@/components/dashboard/ExportButton'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import { getT, getLang } from '@/lib/server-i18n'
import type { MarketplaceType } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

const VALID_MP = ['uzum', 'yandex_market', 'wildberries'] as const
function parseMp(v: string | undefined): MarketplaceType | undefined {
  return (VALID_MP as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function PnlPage({ searchParams }: Props) {
  const params = await searchParams
  const marketplace = parseMp(params.mp)
  const [t, lang, pnl, userShops] = await Promise.all([getT(), getLang(), getMonthlyPnl(6, marketplace), getUserShops()])
  const d = t.dashboard
  // Month names in the UI language — not hardcoded to one locale.
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'
  const monthlyData = pnl.rows.map(m => ({
    ...m,
    month: new Date(m.monthKey + '-01').toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
  }))
  const isEmpty = monthlyData.length === 0
  const hasShops = userShops.length > 0
  const anyEstimated = monthlyData.some(m => m.estimated)
  // Every number in one color — the reader compares magnitudes, not colors.
  const num = 'px-4 py-4 text-right text-[var(--text-base)]'

  const totals = monthlyData.reduce((s, m) => ({
    orders:    s.orders + m.order_count,
    cancelled: s.cancelled + m.cancelled_count,
    revenue:   s.revenue + m.revenue,
    commission: s.commission + m.commission,
    delivery:  s.delivery + m.delivery,
    acquiring: s.acquiring + m.acquiring,
    tax:       s.tax + m.tax,
    ads:       s.ads + m.ads,
    cogs:      s.cogs + m.cogs,
    net:       s.net + m.net,
  }), { orders: 0, cancelled: 0, revenue: 0, commission: 0, delivery: 0, acquiring: 0, tax: 0, ads: 0, cogs: 0, net: 0 })
  const totalExpenses = totals.commission + totals.delivery + totals.acquiring + totals.tax + totals.ads + totals.cogs
  const avgMargin = totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : 0
  const estText = (v: number, isEst: boolean) => `${isEst && v > 0 ? '≈ ' : ''}${fmt(v)}`
  const est = (v: number, isEst: boolean, tooltip?: string) => {
    if (!isEst || v === 0) return fmt(v)
    return <span title={tooltip} className="underline decoration-dotted decoration-[var(--text-muted)] cursor-help">{'≈ '}{fmt(v)}</span>
  }

  const exportData = monthlyData.map(m => ({
    [d.month]:                     m.month,
    [d.ordersCol]:                 m.order_count,
    [d.topSoldCancelled]:          m.cancelled_count,
    [`${d.revenue} (so'm)`]:       Math.round(m.revenue),
    [`${d.commission2} (so'm)`]:   Math.round(m.commission),
    [`${d.delivery} (so'm)`]:      Math.round(m.delivery),
    [`${d.acquiringLabel} (so'm)`]: Math.round(m.acquiring),
    [`${d.taxLabel} (so'm)`]:      Math.round(m.tax),
    [`${d.adsLabel} (so'm)`]:      Math.round(m.ads),
    [`${d.cogsLabel} (so'm)`]:     Math.round(m.cogs),
    [`${d.net} (so'm)`]:           Math.round(m.net),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-2 mb-0.5">
            <FileText className="w-6 h-6" style={{ color: 'var(--c1)' }} />
            {d.pnlTitle}
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            {isEmpty ? d.pnlSubtitleEmpty : d.pnlSubtitle}
          </p>
        </div>
        {!isEmpty && <ExportButton data={exportData} filename="pnl-hisoboti" />}
      </div>

      <Suspense>
        <MarketplaceTabs current={marketplace} />
      </Suspense>

      {isEmpty ? (
        <div className="bg-[var(--bg-card2)] rounded-2xl p-10 text-center" style={{ border: '1px dashed var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-card2)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)' }}>
            <FileText className="w-7 h-7" style={{ color: 'var(--c1)' }} />
          </div>
          <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">
            {hasShops ? d.noOrdersConnectedTitle : d.noData}
          </h2>
          <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">
            {hasShops ? d.noOrdersConnectedDesc : d.noDataPnlDesc}
          </p>
          {!hasShops && (
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg">
              <Settings className="w-4 h-4" /> {d.goToSettings}
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Summary — five cards. "Marketplace payout" mirrors what the
              seller's marketplace balance page shows (revenue − commission −
              delivery = what the marketplace will pay out). "Real profit"
              subtracts the seller's own costs on top (COGS, acquiring, tax,
              ads) — the true bottom line. Both are shown so users can
              cross-check against Uzum/YM/WB's own dashboards without
              confusing the two definitions. */}
          {(() => {
            const marketplacePayout = totals.revenue - totals.commission - totals.delivery
            return (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: d.totalRevenuePnl,   value: fmt(totals.revenue),                     hint: null },
                  { label: d.commission2,       value: est(totals.commission, anyEstimated),     hint: null },
                  { label: d.marketplacePayout, value: est(marketplacePayout, anyEstimated),     hint: d.marketplacePayoutHint },
                  { label: d.cogsLabel,         value: fmt(totals.cogs),                         hint: null },
                  { label: d.netNoCommission,   value: fmt(totals.net),                          hint: null },
                ].map(({ label, value, hint }) => (
                  <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5" title={hint ?? undefined}>
                    <p className="text-[var(--text-muted)] text-xs mb-2">{label}</p>
                    <p className="text-xl font-bold text-[var(--text-base)]">{value}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* How the numbers are computed */}
          {anyEstimated && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs border"
              style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {d.pnlEstimatedNote}{' '}
                ({d.commission2} {pnl.params.commissionPct}% · {d.acquiringLabel} {pnl.params.acquiringPct}% · {d.taxLabel} {pnl.params.taxPct}% · {d.adsLabel} {pnl.params.adPct}%) —{' '}
                <Link href="/dashboard/unit-economics" className="underline" style={{ color: 'var(--c1)' }}>Unit Economics</Link>
              </span>
            </div>
          )}

          {/* Chart */}
          <PnlChart
            data={monthlyData.map(m => ({
              month:   m.month,
              revenue: m.revenue,
              cost:    m.commission + m.delivery + m.acquiring + m.tax + m.ads + m.cogs + m.penalty + m.storageFee + m.additionalPayment,
              profit:  m.net,
              orders:  m.order_count,
            }))}
            revenueLabel={d.revenue}
            costLabel={d.expenses}
            profitLabel={d.net}
            ordersLabel={d.ordersCol}
          />

          {/* Monthly breakdown — every expense line visible, one color */}
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 980 }}>
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                    <th className="text-left font-medium px-4 py-3">{d.month}</th>
                    <th className="text-right font-medium px-4 py-3">{d.ordersCol}</th>
                    <th className="text-right font-medium px-4 py-3">{d.topSoldCancelled}</th>
                    <th className="text-right font-medium px-4 py-3">{d.revenue}</th>
                    <th className="text-right font-medium px-4 py-3">{d.commission2}</th>
                    <th className="text-right font-medium px-4 py-3">{d.delivery}</th>
                    <th className="text-right font-medium px-4 py-3">{d.acquiringLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.taxLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.adsLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.cogsLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.net}</th>
                    <th className="text-right font-medium px-4 py-3">{d.margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {monthlyData.map((m, i) => {
                    const margin = m.revenue > 0 ? (m.net / m.revenue) * 100 : 0
                    return (
                      <tr key={m.month} className={i === monthlyData.length - 1 ? 'bg-[var(--bg-card2)]' : ''}>
                        <td className="px-4 py-4 text-[var(--text-base)] font-medium">
                          {m.month}
                          {i === monthlyData.length - 1 && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--c1)', background: 'var(--bg-card2)' }}>{d.current}</span>
                          )}
                        </td>
                        <td className={num}>{m.order_count}</td>
                        <td className={num}>{m.cancelled_count || '—'}</td>
                        <td className={num}>{fmt(m.revenue)}</td>
                        <td className={num}>{est(m.commission, m.estimated, `≈ ${pnl.params.commissionPct}%`)}</td>
                        <td className={num}>{m.delivery > 0 ? est(m.delivery, m.estimated, `≈ ${pnl.params.lastMilePct}%`) : '—'}</td>
                        <td className={num}>{est(m.acquiring, m.estimated, `≈ ${pnl.params.acquiringPct}%`)}</td>
                        <td className={num}>{est(m.tax, true, `≈ ${pnl.params.taxPct}%`)}</td>
                        <td className={num}>{est(m.ads, m.adSpendEstimated, `≈ ${pnl.params.adPct}%`)}</td>
                        <td className={num}>{m.cogs > 0 ? fmt(m.cogs) : '—'}</td>
                        <td className={`${num} font-bold`}>{fmt(m.net)}</td>
                        <td className={num}>{margin.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                  {/* Totals */}
                  <tr className="border-t border-[var(--border2)]">
                    <td className="px-4 py-4 text-[var(--text-base)] font-bold text-xs uppercase tracking-wide">{d.total}</td>
                    <td className={`${num} font-bold`}>{totals.orders}</td>
                    <td className={`${num} font-bold`}>{totals.cancelled || '—'}</td>
                    <td className={`${num} font-bold`}>{fmt(totals.revenue)}</td>
                    <td className={`${num} font-bold`}>{est(totals.commission, anyEstimated, `≈ ${pnl.params.commissionPct}%`)}</td>
                    <td className={`${num} font-bold`}>{totals.delivery > 0 ? fmt(totals.delivery) : '—'}</td>
                    <td className={`${num} font-bold`}>{est(totals.acquiring, anyEstimated, `≈ ${pnl.params.acquiringPct}%`)}</td>
                    <td className={`${num} font-bold`}>{est(totals.tax, true, `≈ ${pnl.params.taxPct}%`)}</td>
                    <td className={`${num} font-bold`}>{est(totals.ads, monthlyData.some(m => m.adSpendEstimated), `≈ ${pnl.params.adPct}%`)}</td>
                    <td className={`${num} font-bold`}>{totals.cogs > 0 ? fmt(totals.cogs) : '—'}</td>
                    <td className={`${num} font-bold`}>{fmt(totals.net)}</td>
                    <td className={`${num} font-bold`}>{avgMargin.toFixed(1)}%</td>
                  </tr>
                  {/* Total expenses line */}
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs text-[var(--text-muted)]" />
                    <td colSpan={6} className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">
                      {d.commission2} + {d.delivery} + {d.acquiringLabel} + {d.taxLabel} + {d.adsLabel} + {d.cogsLabel}:
                    </td>
                    <td className={`${num} font-bold`}>{fmt(totalExpenses)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
