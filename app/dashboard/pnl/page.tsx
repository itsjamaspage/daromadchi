import { FileText, Settings } from 'lucide-react'
import InfoTooltip from '@/components/dashboard/InfoTooltip'
import Link from 'next/link'
import { Suspense } from 'react'
import { count, inArray } from 'drizzle-orm'
import { db, orders } from '@/lib/db'
import { getPnl, getCogsBreakdown, getDeliveryByMarketplace } from '@/lib/db/pnl'
import CogsCardEditor from '@/components/dashboard/CogsCardEditor'
import { getUserShops, getShopIds } from '@/lib/db/shop-context'
import PnlChart from './PnlChart'
import ExportButton from '@/components/dashboard/ExportButton'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import CalendarPicker from '@/components/dashboard/CalendarPicker'
import { getT, getLang } from '@/lib/server-i18n'
import { currentUserAccess } from '@/lib/billing/entitlement'
import FeatureLock from '@/components/dashboard/FeatureLock'
import type { MarketplaceType } from '@/lib/types'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

const VALID_MP = ['uzum', 'yandex_market'] as const
function parseMp(v: string | undefined): MarketplaceType | undefined {
  return (VALID_MP as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

function parseRange(params: Record<string, string>): {
  from: Date; to: Date; bucket: 'day' | 'month'; period: string
} {
  const to = new Date()
  to.setHours(23, 59, 59, 999)

  // Custom range wins over any preset.
  if (params.from && params.to) {
    const from = new Date(params.from + 'T00:00:00')
    const toDate = new Date(params.to + 'T23:59:59')
    const diffDays = Math.round((toDate.getTime() - from.getTime()) / 86400000)
    return { from, to: toDate, bucket: diffDays > 31 ? 'month' : 'day', period: '' }
  }

  // Preset "N days" (kept for backwards compat with old links).
  // Auto-picks daily bucket for short ranges (≤31 days) — this is the
  // feature branch's intent, kept here so N-day presets do the right
  // thing without changing the "default = current month" behavior
  // that shipped with the recent Payouts/PnL unification.
  if (params.days) {
    const days = Math.max(1, Math.min(3650, Number(params.days) || 30))
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    from.setHours(0, 0, 0, 0)
    return { from, to, bucket: days > 31 ? 'month' : 'day', period: String(days) }
  }

  // Default: the CURRENT WEEK (Mon–Sun). The P&L is read a week at a time and the
  // ‹ / › buttons page a week each — so the default opens on "this week", not a
  // 90-day span that buries it. Empty future days in the week simply don't render
  // (the P&L only makes a row per day that actually has orders). Daily bucket.
  const monday = new Date(to)
  const dow = monday.getDay()                       // 0=Sun … 6=Sat
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { from: monday, to: sunday, bucket: 'day', period: '' }
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function PnlPage({ searchParams }: Props) {
  // P&L is a finances surface: it reads the same settled money the payouts page
  // does, so leaving it open would hand a gated seller the data through the
  // side door. Gated BEFORE the queries — see the note on the analytics page.
  const [gateLang, access] = await Promise.all([getLang(), currentUserAccess('finances')])
  if (!access.allowed) {
    return <FeatureLock lang={gateLang} feature="finances" hadTrial={access.trialEnded} />
  }

  const params = await searchParams
  const marketplace = parseMp(params.mp)
  const range = parseRange(params)
  // Second query: TODAY's data ONLY, day-bucket. Shown as a separate top
  // row in the table so the seller sees "sales today" at a glance — the
  // previous relabel just changed the month row's text without changing
  // its data, which was misleading (the row said "30 July" but held all
  // of July). Now the today row's numbers are actually today-only, and
  // the monthly rows below continue to hold whole-month totals.
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [t, lang, pnl, todayPnl, userShops, cogsProducts, deliveryByMp] = await Promise.all([
    getT(), getLang(),
    getPnl({ from: range.from, to: range.to, bucket: range.bucket, marketplace }),
    getPnl({ from: todayStart, to: todayEnd, bucket: 'day', marketplace }),
    getUserShops(),
    // Products behind the range's Себестоимость — backs the card's inline
    // per-product cost editor. Same range/marketplace as the totals.
    getCogsBreakdown({ from: range.from, to: range.to, marketplace }),
    // Per-store split of the Доставка figure, so its tooltip names the store.
    getDeliveryByMarketplace({ from: range.from, to: range.to, marketplace }),
  ])
  const d = t.dashboard
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'

  function labelFor(key: string): string {
    if (range.bucket === 'day') {
      const dt = new Date(key + 'T00:00:00Z')
      return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    }
    const dt = new Date(key + '-01T00:00:00Z')
    const monthName = dt.toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${dt.getUTCFullYear()}`
  }

  // Build the today row from its dedicated single-day query — but ONLY for the
  // month-bucket view, where "today" would otherwise be hidden inside the whole
  // current-month row. In a day/week view today already has its own day row, so
  // a separate today row would just duplicate it.
  const todayLabel = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const todayRow = range.bucket === 'month' && todayPnl.rows[0]
    ? { ...todayPnl.rows[0], month: todayLabel }
    : null

  // Filter out the current-month row from the monthly rows — today's
  // data is now shown by the todayRow and the whole-month version was
  // redundant/confusing (both rows said "July 2026"'s numbers). Only
  // PAST months get their own monthly row; today gets its dedicated
  // top row; totals still reflect the full picked range.
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthlyData = pnl.rows
    .filter(m => m.bucketKey !== currentMonthKey)
    .map(m => ({ ...m, month: labelFor(m.bucketKey) }))
  // Totals reduce over ALL rows the query returned (INCLUDING the
  // current month that we hid from the row display) so the итого row
  // still reflects the full picked range, not just past months.
  const allRowsForTotals = pnl.rows
  const isEmpty = pnl.rows.length === 0 || pnl.rows.every(m => m.revenue === 0 && m.cancelled_count === 0 && m.pendingRevenue === 0)
  const hasShops = userShops.length > 0

  // Only when the picked range is empty: does the store have ANY orders ever
  // (respecting the current marketplace tab)? Lets the empty state point at the
  // date filter ("no orders in this period, widen the range") when widening would
  // actually help, and fall back to the honest "no orders yet" for a brand-new
  // store. One cheap count, run only in the empty case.
  let hasAnyOrders = false
  if (isEmpty && hasShops) {
    const shopIdsForCount = await getShopIds(marketplace)
    if (shopIdsForCount && shopIdsForCount.length > 0) {
      const [{ n }] = await db.select({ n: count() }).from(orders).where(inArray(orders.shop_id, shopIdsForCount))
      hasAnyOrders = n > 0
    }
  }
  const anyEstimated = pnl.rows.some(m => m.estimated)
  const num = 'px-4 py-4 text-right text-[var(--text-base)]'

  const totals = allRowsForTotals.reduce((s, m) => ({
    orders:    s.orders + m.order_count,
    cancelled: s.cancelled + m.cancelled_count,
    revenue:   s.revenue + m.revenue,
    commission: s.commission + m.commission,
    delivery:  s.delivery + m.delivery,
    otherFees: s.otherFees + m.otherFees,
    acquiring: s.acquiring + m.acquiring,
    tax:       s.tax + m.tax,
    cogs:      s.cogs + m.cogs,
    net:       s.net + m.net,
    pendingRevenue: s.pendingRevenue + m.pendingRevenue,
    pendingCount:   s.pendingCount + m.pendingCount,
  }), { orders: 0, cancelled: 0, revenue: 0, commission: 0, delivery: 0, otherFees: 0, acquiring: 0, tax: 0, cogs: 0, net: 0, pendingRevenue: 0, pendingCount: 0 })
  // "Прочие удержания" — real marketplace deductions that are neither the sales
  // commission nor delivery (acquiring, ads, loyalty, penalties). Split out of
  // commission so that line is the true commission. Localised inline.
  // NB: storage is deliberately NOT listed — FBS/DBS sellers store their own
  // goods, so the marketplace never charges them a storage fee (and the
  // storage_fee column is never populated). Mentioning it here misled sellers.
  const otherFeesLabel = lang === 'ru' ? 'Прочие' : lang === 'uz' ? 'Boshqa' : 'Other'
  const otherFeesHint = lang === 'ru'
    ? 'Прочие удержания маркетплейса: эквайринг, реклама, штрафы и т.п. — раньше они попадали в «Комиссию».'
    : lang === 'uz'
    ? 'Marketpleysning boshqa ushlab qolishlari: ekvayring, reklama, jarimalar — avval «Komissiya»ga tushardi.'
    : 'Other marketplace deductions: acquiring, ads, penalties — previously folded into Commission.'
  // In-transit ("В процессе"): earned only once delivered, so shown apart from
  // Общая выручка / Чистая прибыль. Localised inline to avoid threading three
  // more keys through the shared i18n file for one banner.
  const pendingCopy = {
    ru: { label: 'В процессе', sub: (n: number) => `${n} ${n === 1 ? 'заказ' : 'заказа(ов)'} в доставке — доход учтётся после доставки, в прибыль пока не входит` },
    uz: { label: 'Jarayonda', sub: (n: number) => `${n} ta buyurtma yetkazilmoqda — daromad yetkazilgach hisoblanadi, hozircha foydaga kirmaydi` },
    en: { label: 'In progress', sub: (n: number) => `${n} order(s) in delivery — counted as revenue once delivered, not in profit yet` },
  }[lang === 'ru' ? 'ru' : lang === 'uz' ? 'uz' : 'en']
  // Доставка tooltip: name the store(s) that actually charged the logistics,
  // from the per-marketplace settlement split. Only non-zero stores are shown.
  const mpName = (mp: string) => mp === 'uzum' ? 'Uzum' : mp === 'yandex_market' ? 'Yandex Market' : mp
  const deliveryStores = deliveryByMp.filter(s => s.delivery > 0)
  const deliveryHint = deliveryStores.length > 0
    ? `${d.pnlHintDelivery} ${d.pnlDeliveryByStore} ${deliveryStores.map(s => `${mpName(s.marketplace)} — ${fmt(s.delivery)}`).join(' · ')}`
    : d.pnlHintDelivery
  const avgMargin = totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : 0
  const est = (v: number, isEst: boolean, tooltip?: string) => {
    if (!isEst || v === 0) return fmt(v)
    return <span title={tooltip} className="underline decoration-dotted decoration-[var(--text-muted)] cursor-help">{'≈ '}{fmt(v)}</span>
  }
  // Yandex fee that hasn't settled yet: show a muted "pending" placeholder
  // rather than a fabricated percentage estimate or a misleading zero.
  const pendingCell = (
    <span title={d.pnlFeePendingHint} className="text-[var(--text-muted)] italic cursor-help">{d.pnlFeePending}</span>
  )
  const totalsFeePending = allRowsForTotals.some(m => m.feePending)

  const exportData = monthlyData.map(m => ({
    [d.date]:                      m.month,
    [d.ordersCol]:                 m.order_count,
    [d.topSoldCancelled]:          m.cancelled_count,
    [`${d.revenue} (so'm)`]:       Math.round(m.revenue),
    [`${d.commission2} (so'm)`]:   Math.round(m.commission),
    [`${d.delivery} (so'm)`]:      Math.round(m.delivery),
    [`${otherFeesLabel} (so'm)`]:  Math.round(m.otherFees),
    [`${d.acquiringLabel} (so'm)`]: Math.round(m.acquiring),
    [`${d.taxLabel} (so'm)`]:      Math.round(m.tax),
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
        <div className="flex items-center gap-2">
          <Suspense>
            <CalendarPicker
              from={params.from ?? range.from.toISOString().slice(0, 10)}
              to={params.to ?? range.to.toISOString().slice(0, 10)}
            />
          </Suspense>
          {!isEmpty && <ExportButton data={exportData} filename="pnl-hisoboti" />}
        </div>
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
            {!hasShops ? d.noData : hasAnyOrders ? d.pnlNoOrdersRangeTitle : d.noOrdersConnectedTitle}
          </h2>
          <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">
            {!hasShops ? d.noDataPnlDesc : hasAnyOrders ? d.pnlNoOrdersRangeDesc : d.noOrdersConnectedDesc}
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
          {(() => {
            const marketplacePayout = totals.revenue - totals.commission - totals.delivery - totals.otherFees
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: d.totalRevenuePnl,   value: fmt(totals.revenue),                     hint: d.pnlHintRevenue,      node: null },
                  { label: d.commission2,       value: est(totals.commission, anyEstimated),     hint: d.pnlHintCommission,   node: null },
                  // Delivery as its own headline card, next to Комиссия — the
                  // same total shown in the table (mirrors its pending state so
                  // an unsettled Yandex delivery reads "pending", not a zero).
                  { label: d.delivery,          value: totalsFeePending && totals.delivery === 0 ? pendingCell : fmt(totals.delivery), hint: deliveryHint, node: null },
                  { label: d.marketplacePayout, value: est(marketplacePayout, anyEstimated),     hint: d.marketplacePayoutHint, node: null },
                  // Себестоимость is the one user-editable input: its card opens
                  // a per-product cost editor (writes real cost_price, P&L
                  // recomputes). node overrides the plain value render.
                  { label: d.cogsLabel,         value: fmt(totals.cogs),                         hint: d.pnlHintCogs,
                    node: <CogsCardEditor
                      total={fmt(totals.cogs)}
                      products={cogsProducts}
                      labels={{ title: d.pnlCogsEditTitle, hint: d.pnlCogsEditHint, product: d.pnlCogsEditProduct, qty: d.pnlCogsEditQty, cost: d.pnlCogsEditCost, empty: d.pnlCogsEditEmpty, done: d.pnlCogsEditDone }}
                    /> },
                  { label: d.netNoCommission,   value: fmt(totals.net),                          hint: d.pnlHintNet,          node: null },
                ].map(({ label, value, hint, node }, i) => (
                  <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
                    <div className="flex items-center gap-1 mb-2">
                      <p className="text-[var(--text-muted)] text-xs">{label}</p>
                      {/* Real popover — shows on hover AND on click/tap. The
                          native `title` attribute never appears on touch and
                          lags on desktop, so the "?" was doing nothing useful.
                          Right-half cards open leftward so the last card's
                          tooltip isn't clipped off the right edge. */}
                      <InfoTooltip text={hint} align={i >= 3 ? 'right' : 'left'} />
                    </div>
                    {node ?? <p className="text-xl font-bold text-[var(--text-base)]">{value}</p>}
                  </div>
                ))}
              </div>
            )
          })()}

          {totals.pendingRevenue > 0 && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs border"
              style={{ background: 'color-mix(in srgb, var(--c1) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--c1) 30%, transparent)' }}>
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--c1)' }} />
              <span style={{ color: 'var(--text-base)' }}>
                <span className="font-semibold">{pendingCopy.label}: {fmt(totals.pendingRevenue)}</span>
                <span className="text-[var(--text-muted)]"> — {pendingCopy.sub(totals.pendingCount)}</span>
              </span>
            </div>
          )}

          {anyEstimated && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs border"
              style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {d.pnlEstimatedNote}{' '}
                ({d.commission2} {pnl.params.commissionPct}% · {d.acquiringLabel} {pnl.params.acquiringPct}% · {d.taxLabel} {pnl.params.taxPct}%) —{' '}
                <Link href="/dashboard/unit-economics" className="underline" style={{ color: 'var(--c1)' }}>Unit Economics</Link>
              </span>
            </div>
          )}

          <PnlChart
            // Chart uses ALL rows the query returned (including the
            // current month we hid from the table). Without this the
            // chart is empty whenever the picked range doesn't include
            // any past month with orders — e.g. the default "current
            // month → today" view had zero bars because the only row
            // with data (this month) was filtered out.
            data={pnl.rows.map(m => ({
              month:   labelFor(m.bucketKey),
              revenue: m.revenue,
              cost:    m.commission + m.delivery + m.otherFees + m.acquiring + m.tax + m.cogs + m.penalty + m.storageFee + m.additionalPayment,
              profit:  m.net,
              orders:  m.order_count,
            }))}
            revenueLabel={d.revenue}
            costLabel={d.expenses}
            profitLabel={d.net}
            ordersLabel={d.ordersCol}
          />

          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 980 }}>
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                    <th className="text-left font-medium px-4 py-3">{d.date}</th>
                    <th className="text-right font-medium px-4 py-3">{d.ordersCol}</th>
                    <th className="text-right font-medium px-4 py-3">{d.topSoldCancelled}</th>
                    <th className="text-right font-medium px-4 py-3">{d.revenue}</th>
                    <th className="text-right font-medium px-4 py-3">{d.commission2}</th>
                    <th className="text-right font-medium px-4 py-3">{d.delivery}</th>
                    <th className="text-right font-medium px-4 py-3" title={otherFeesHint}>{otherFeesLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.acquiringLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.taxLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.cogsLabel}</th>
                    <th className="text-right font-medium px-4 py-3">{d.net}</th>
                    <th className="text-right font-medium px-4 py-3">{d.margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {/* Today's row — separate query, day-bucket, TODAY only.
                      Highlighted background + текущий tag so the seller
                      sees "here's what happened today specifically". Not
                      counted in totals (avoids double-count with the
                      current month row below). */}
                  {todayRow && (
                    <tr key="today" className="bg-[var(--bg-card2)]" style={{ borderBottom: '2px solid var(--border2)' }}>
                      <td className="px-4 py-4 text-[var(--text-base)] font-medium">
                        {todayRow.month}
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--c1)', background: 'var(--bg-base)' }}>{d.current}</span>
                      </td>
                      <td className={num}>{todayRow.order_count}</td>
                      <td className={num}>{todayRow.cancelled_count || '—'}</td>
                      <td className={num}>{fmt(todayRow.revenue)}</td>
                      <td className={num}>{todayRow.feePending && todayRow.commission === 0 ? pendingCell : est(todayRow.commission, todayRow.estimated, `≈ ${pnl.params.commissionPct}%`)}</td>
                      <td className={num}>{todayRow.feePending && todayRow.delivery === 0 ? pendingCell : todayRow.delivery > 0 ? est(todayRow.delivery, todayRow.estimated, `≈ ${pnl.params.lastMilePct}%`) : '—'}</td>
                      <td className={num}>{todayRow.otherFees > 0 ? fmt(todayRow.otherFees) : '—'}</td>
                      <td className={num}>{est(todayRow.acquiring, todayRow.estimated, `≈ ${pnl.params.acquiringPct}%`)}</td>
                      <td className={num}>{est(todayRow.tax, true, `≈ ${pnl.params.taxPct}%`)}</td>
                      <td className={num}>{todayRow.cogs > 0 ? fmt(todayRow.cogs) : '—'}</td>
                      <td className={`${num} font-bold`}>{fmt(todayRow.net)}</td>
                      <td className={num}>{todayRow.revenue > 0 ? ((todayRow.net / todayRow.revenue) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  )}
                  {monthlyData.map(m => {
                    const margin = m.revenue > 0 ? (m.net / m.revenue) * 100 : 0
                    return (
                      <tr key={m.bucketKey}>
                        <td className="px-4 py-4 text-[var(--text-base)] font-medium">
                          {m.month}
                        </td>
                        <td className={num}>{m.order_count}</td>
                        <td className={num}>{m.cancelled_count || '—'}</td>
                        <td className={num}>{fmt(m.revenue)}</td>
                        <td className={num}>{m.feePending && m.commission === 0 ? pendingCell : est(m.commission, m.estimated, `≈ ${pnl.params.commissionPct}%`)}</td>
                        <td className={num}>{m.feePending && m.delivery === 0 ? pendingCell : m.delivery > 0 ? est(m.delivery, m.estimated, `≈ ${pnl.params.lastMilePct}%`) : '—'}</td>
                        <td className={num}>{m.otherFees > 0 ? fmt(m.otherFees) : '—'}</td>
                        <td className={num}>{est(m.acquiring, m.estimated, `≈ ${pnl.params.acquiringPct}%`)}</td>
                        <td className={num}>{est(m.tax, true, `≈ ${pnl.params.taxPct}%`)}</td>
                        <td className={num}>{m.cogs > 0 ? fmt(m.cogs) : '—'}</td>
                        <td className={`${num} font-bold`}>{fmt(m.net)}</td>
                        <td className={num}>{margin.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-[var(--border2)]">
                    <td className="px-4 py-4 text-[var(--text-base)] font-bold text-xs uppercase tracking-wide">{d.total}</td>
                    <td className={`${num} font-bold`}>{totals.orders}</td>
                    <td className={`${num} font-bold`}>{totals.cancelled || '—'}</td>
                    <td className={`${num} font-bold`}>{fmt(totals.revenue)}</td>
                    <td className={`${num} font-bold`}>{totalsFeePending && totals.commission === 0 ? pendingCell : est(totals.commission, anyEstimated, `≈ ${pnl.params.commissionPct}%`)}</td>
                    <td className={`${num} font-bold`}>{totalsFeePending && totals.delivery === 0 ? pendingCell : totals.delivery > 0 ? fmt(totals.delivery) : '—'}</td>
                    <td className={`${num} font-bold`}>{totals.otherFees > 0 ? fmt(totals.otherFees) : '—'}</td>
                    <td className={`${num} font-bold`}>{est(totals.acquiring, anyEstimated, `≈ ${pnl.params.acquiringPct}%`)}</td>
                    <td className={`${num} font-bold`}>{est(totals.tax, true, `≈ ${pnl.params.taxPct}%`)}</td>
                    <td className={`${num} font-bold`}>{totals.cogs > 0 ? fmt(totals.cogs) : '—'}</td>
                    <td className={`${num} font-bold`}>{fmt(totals.net)}</td>
                    <td className={`${num} font-bold`}>{avgMargin.toFixed(1)}%</td>
                  </tr>
                  {/* Marketplace-withheld subtotal: commission + delivery +
                      acquiring only (what the marketplace itself took) — a
                      readability sum of cells already shown above, no new
                      calculation. (An all-costs total row used to sit below
                      this; removed as redundant with the Чистая column, which
                      already nets every expense out of revenue.) */}
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-xs text-[var(--text-muted)]" />
                    <td colSpan={6} className="px-4 py-2 text-right text-xs text-[var(--text-muted)]">
                      {d.pnlMpWithheld}:
                    </td>
                    <td className={`${num} font-bold`}>{fmt(totals.commission + totals.delivery + totals.otherFees + totals.acquiring)}</td>
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
