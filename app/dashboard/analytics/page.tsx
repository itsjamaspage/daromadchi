import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/api/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'

type AnalyticsT = (typeof dashT)['uz']['analytics']
import {
  BarChart2, TrendingUp, Clock, ShoppingBag, AlertTriangle,
  Target, Calendar, RefreshCw, Lock, ArrowRight, Zap,
} from 'lucide-react'

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}
function fmtS(n: number) { return fmt(n) + " so'm" }

function marginCls(pct: number) {
  if (pct >= 30) return 'text-emerald-400'
  if (pct >= 10) return 'text-amber-400'
  return 'text-red-400'
}
function marginBadge(pct: number) {
  if (pct >= 30) return 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
  if (pct >= 10) return 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
  return 'bg-red-500/10 border border-red-500/20 text-red-400'
}
function drrCls(pct: number) {
  if (pct < 15) return 'text-emerald-400'
  if (pct <= 30) return 'text-amber-400'
  return 'text-red-400'
}
function priceDiffCls(diff: number) {
  if (diff > 20)  return 'text-red-400'
  if (diff < -10) return 'text-emerald-400'
  return 'text-amber-400'
}
function heatCls(val: number, max: number) {
  if (max === 0 || val === 0) return 'bg-white/[0.04] text-slate-600'
  const r = val / max
  if (r > 0.8) return 'bg-violet-500/70 text-white font-bold'
  if (r > 0.6) return 'bg-violet-500/50 text-violet-100'
  if (r > 0.4) return 'bg-violet-500/30 text-violet-200'
  if (r > 0.2) return 'bg-violet-500/18 text-slate-300'
  return 'bg-violet-500/8 text-slate-400'
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function Empty({ t }: { t: AnalyticsT }) {
  return (
    <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
      <RefreshCw className="w-5 h-5 opacity-30" />
      {t.emptyAfterSync}
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function FreeBanner({ t }: { t: AnalyticsT }) {
  return (
    <div className="flex items-center gap-3 bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3 text-sm mb-1">
      <Lock className="w-4 h-4 text-violet-400 shrink-0" />
      <span className="text-slate-300">
        {t.freeBannerPre} <strong className="text-white">{t.freeBannerDays}</strong> {t.freeBannerPost}&nbsp;
        <Link href="/pricing" className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2">{t.freeBannerLink}</Link>.
      </span>
    </div>
  )
}

// ── Data types ─────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string; status: string; revenue: string | null; marketplace_fee: string | null
  delivery_cost: string | null; items_count: number; ordered_at: string
}
type ProductRow = {
  id: string; title: string; selling_price: string | null; cost_price: string | null
  stock_quantity: number; category: string | null
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface Props { searchParams: Promise<Record<string, string>> }

export default async function AnalyticsPage({ searchParams }: Props) {
  const params  = await searchParams
  const lang    = await getLang()
  const t       = dashT[lang].analytics
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan   = await getUserPlan(user.id)
  const isFree = plan === 'free'
  const rawDays = Number(params.days) || 30
  const days   = isFree ? 7 : Math.min(Math.max(rawDays, 7), 365)

  const { data: shopsData } = await supabase.from('shops').select('id').eq('user_id', user.id)
  const shopIds = (shopsData ?? []).map((s: { id: string }) => s.id)

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const since14 = new Date()
  since14.setDate(since14.getDate() - 14)
  since14.setHours(0, 0, 0, 0)

  // ── Empty state if no shops ────────────────────────────────────────────────
  if (shopIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader isFree={isFree} days={days} t={t} />
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <BarChart2 className="w-10 h-10 text-violet-400/40 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">{t.noShop}</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
            {t.noShopDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            {t.goSettings} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const [ordersRes, productsRes, orders14Res] = await Promise.all([
    supabase.from('orders')
      .select('id, status, revenue, marketplace_fee, delivery_cost, items_count, ordered_at')
      .in('shop_id', shopIds).gte('ordered_at', since.toISOString()),
    supabase.from('products')
      .select('id, title, selling_price, cost_price, stock_quantity, category')
      .in('shop_id', shopIds),
    supabase.from('orders')
      .select('id, status, revenue, marketplace_fee, delivery_cost, items_count, ordered_at')
      .in('shop_id', shopIds).gte('ordered_at', since14.toISOString()),
  ])

  const orders    = (ordersRes.data   ?? []) as OrderRow[]
  const products  = (productsRes.data ?? []) as ProductRow[]
  const orders14  = (orders14Res.data ?? []) as OrderRow[]

  // ── Section 1: Funnel ──────────────────────────────────────────────────────
  const active   = orders.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const returned = orders.filter(o => o.status === 'cancelled' || o.status === 'returned')
  const totalRev  = active.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
  const totalComm = active.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const totalDel  = active.reduce((s, o) => s + Number(o.delivery_cost ?? 0), 0)
  const totalProfit = totalRev - totalComm - totalDel
  const marginPct   = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0

  // ── Section 2: Product ranking ────────────────────────────────────────────
  const productRanking = products
    .map(p => {
      const price  = Number(p.selling_price ?? 0)
      const cost   = Number(p.cost_price   ?? 0)
      const profit = price - cost
      const margin = price > 0 ? (profit / price) * 100 : 0
      return { id: p.id, title: p.title, price, cost, profit, margin, category: p.category }
    })
    .filter(p => p.price > 0)
    .sort((a, b) => b.profit - a.profit)

  // ── Section 3: Weekly comparison ──────────────────────────────────────────
  const now = new Date()
  const dow = now.getDay() === 0 ? 7 : now.getDay()
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - dow + 1)
  thisMonday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(lastMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday)
  lastSunday.setMilliseconds(-1)

  function wkStats(rows: OrderRow[]) {
    const a = rows.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
    const r = rows.filter(o => o.status === 'cancelled' || o.status === 'returned')
    const rev  = a.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
    const prof = a.reduce((s, o) => s + Number(o.revenue ?? 0) - Number(o.marketplace_fee ?? 0) - Number(o.delivery_cost ?? 0), 0)
    return { orders: a.length, revenue: rev, profit: prof, returns: r.length }
  }

  const thisWkStats = wkStats(orders14.filter(o => new Date(o.ordered_at) >= thisMonday))
  const lastWkStats = wkStats(orders14.filter(o => {
    const d = new Date(o.ordered_at); return d >= lastMonday && d <= lastSunday
  }))

  function delta(curr: number, prev: number) {
    if (prev === 0) return null
    const pct = ((curr - prev) / prev) * 100
    return { pct: Math.abs(pct).toFixed(0), up: curr >= prev }
  }

  // ── Section 4: Ad efficiency ──────────────────────────────────────────────
  // marketplace_fee as proxy for commission/ad spend
  const totalAdSpend = totalComm
  const drrTotal     = totalRev > 0 ? (totalAdSpend / totalRev) * 100 : 0
  const adRows = productRanking.slice(0, 12).map(p => {
    const estCommRate = 0.12
    const adSpend     = Math.round(p.price * estCommRate)
    const drr         = p.price > 0 ? (adSpend / p.price) * 100 : 0
    return { title: p.title, adSpend, profit: p.profit, drr }
  })

  // ── Section 5: Returns analysis ───────────────────────────────────────────
  const returnRate  = orders.length > 0 ? (returned.length / orders.length) * 100 : 0
  const returnedRev = returned.reduce((s, o) => s + Number(o.revenue ?? 0), 0)

  // ── Section 6: Price positioning ──────────────────────────────────────────
  const MOCK_AVGS: Record<string, number> = {
    'Kiyim': 85_000, 'Elektronika': 450_000, 'Uy': 125_000, 'Sport': 95_000,
    "Go'zallik": 75_000, 'Oziq-ovqat': 35_000, 'Avto': 280_000, 'Bolalar': 65_000, 'Boshqa': 120_000,
  }
  const pricePos = productRanking.slice(0, 15).map(p => {
    const avg  = MOCK_AVGS[p.category ?? 'Boshqa'] ?? MOCK_AVGS['Boshqa']
    const diff = ((p.price - avg) / avg) * 100
    return { ...p, avg, diff }
  })

  // ── Section 7: Best selling time ──────────────────────────────────────────
  const DAYS_UZ = t.days
  const DAYS_ORD = [1, 2, 3, 4, 5, 6, 0]

  const byDay  = new Array(7).fill(0)
  const byHour = new Array(24).fill(0)
  for (const o of active) {
    const d = new Date(o.ordered_at)
    byDay[d.getDay()]++
    byHour[d.getHours()]++
  }
  const maxDay  = Math.max(...byDay,  1)
  const maxHour = Math.max(...byHour, 1)

  const hasOrders   = orders.length > 0
  const hasProducts = products.length > 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader isFree={isFree} days={days} t={t} />
      {isFree && <FreeBanner t={t} />}

      {/* ── 1. Sales Funnel ───────────────────────────────────────────────── */}
      <Section title={t.funnelTitle} icon={TrendingUp}>
        {!hasOrders ? <Empty t={t} /> : (
          <div className="p-5">
            <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
              {[
                { label: t.funnelImpressions, value: '—',              sub: t.mpData, dim: true },
                { label: t.funnelProductPage, value: '—',              sub: t.mpData, dim: true },
                { label: t.funnelCart,        value: '—',              sub: t.mpData, dim: true },
                { label: t.funnelOrder,       value: fmt(active.length), sub: fmtS(totalRev),         dim: false },
                { label: t.funnelProfit,      value: fmtS(totalProfit), sub: `${marginPct.toFixed(1)}% ${t.marginSuffix}`, dim: false },
              ].map((stage, i, arr) => (
                <div key={stage.label} className="flex items-center shrink-0">
                  <div className={`flex flex-col items-center justify-center px-5 py-4 rounded-xl border min-w-[140px] text-center
                    ${stage.dim
                      ? 'bg-white/[0.02] border-[var(--border)]'
                      : 'bg-violet-500/8 border-violet-500/20'}`}>
                    <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{stage.label}</p>
                    <p className={`font-bold text-lg ${stage.dim ? 'text-slate-600' : 'text-white'}`}>{stage.value}</p>
                    <p className={`text-[11px] mt-0.5 ${stage.dim ? 'text-slate-700' : 'text-slate-400'}`}>{stage.sub}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="px-1 text-slate-700 text-lg shrink-0">→</div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-slate-600 text-xs mt-3">
              {t.funnelNote}
            </p>
          </div>
        )}
      </Section>

      {/* ── 2. Product Profit Ranking ─────────────────────────────────────── */}
      <Section title={t.rankingTitle} icon={BarChart2}>
        {!hasProducts ? <Empty t={t} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                  <th className="text-left font-medium px-5 py-3">{t.colProductName}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colSales}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colRevenue}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colCommission}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colProfitUnit}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colProfitability}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {productRanking.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium text-xs">{p.title}</p>
                      {p.category && <p className="text-slate-600 text-[10px]">{p.category}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-500 text-xs">—</td>
                    <td className="px-4 py-3.5 text-right text-slate-300 text-xs">{fmtS(p.price)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400/70 text-xs">−{fmtS(Math.round(p.price * 0.12))}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-semibold text-xs ${p.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtS(p.profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${marginBadge(p.margin)}`}>
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 3. Weekly Comparison ──────────────────────────────────────────── */}
      <Section title={t.weeklyTitle} icon={Calendar}>
        {!hasOrders ? <Empty t={t} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                  <th className="text-left font-medium px-5 py-3">{t.colMetric}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colThisWeek}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colLastWeek}</th>
                  <th className="text-right font-medium px-4 py-3">{t.colDiff}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {([
                  { label: t.mOrders,  curr: thisWkStats.orders,  prev: lastWkStats.orders,  isNum: true,  isReturns: false },
                  { label: t.mRevenue, curr: thisWkStats.revenue, prev: lastWkStats.revenue, isNum: false, isReturns: false },
                  { label: t.mProfit,  curr: thisWkStats.profit,  prev: lastWkStats.profit,  isNum: false, isReturns: false },
                  { label: t.mReturns, curr: thisWkStats.returns, prev: lastWkStats.returns, isNum: true,  isReturns: true },
                ] as { label: string; curr: number; prev: number; isNum: boolean; isReturns: boolean }[]).map(row => {
                  const d = delta(row.curr, row.prev)
                  const isReturns = row.isReturns
                  return (
                    <tr key={row.label} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-slate-300 font-medium">{row.label}</td>
                      <td className="px-4 py-3.5 text-right text-white font-semibold">
                        {row.isNum ? fmt(row.curr) : fmtS(row.curr)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400">
                        {row.isNum ? fmt(row.prev) : fmtS(row.prev)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {d ? (
                          <span className={`text-xs font-semibold ${
                            (d.up && !isReturns) || (!d.up && isReturns)
                              ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {d.up ? '↑' : '↓'} {d.pct}%
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 4. Ad Efficiency ──────────────────────────────────────────────── */}
      <Section title={t.adTitle} icon={Zap}>
        {!hasProducts ? <Empty t={t} /> : (
          <div className="p-5 space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t.adTotalSpend,   value: fmtS(totalAdSpend) },
                { label: t.adTotalRevenue, value: fmtS(totalRev) },
                { label: t.adDrrTotal,     value: `${drrTotal.toFixed(1)}%`, colorCls: drrCls(drrTotal) },
              ].map(c => (
                <div key={c.label} className="bg-[#1a1a2e] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
                  <p className={`font-bold text-base ${(c as { colorCls?: string }).colorCls ?? 'text-white'}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-[var(--border)]">
                    <th className="text-left font-medium py-2">{t.colProduct}</th>
                    <th className="text-right font-medium px-3 py-2">{t.colAdSpend}</th>
                    <th className="text-right font-medium px-3 py-2">{t.colSales}</th>
                    <th className="text-right font-medium px-3 py-2">{t.colProfitUnit}</th>
                    <th className="text-right font-medium px-3 py-2">{t.colDrr}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {adRows.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 text-slate-300 text-xs font-medium">{r.title}</td>
                      <td className="px-3 py-3 text-right text-red-400/80 text-xs">−{fmtS(r.adSpend)}</td>
                      <td className="px-3 py-3 text-right text-slate-500 text-xs">—</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-xs font-semibold ${r.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtS(r.profit)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-xs font-bold ${drrCls(r.drr)}`}>{r.drr.toFixed(0)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400/80">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-300">{t.adNoteLabel}</strong> {t.adNote}
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 5. Returns Analysis ───────────────────────────────────────────── */}
      <Section title={t.returnsTitle} icon={ShoppingBag}>
        {!hasOrders ? <Empty t={t} /> : (
          <div className="p-5 space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t.retTotal, value: (fmt(returned.length) + ' ' + t.retCount).trim() },
                { label: t.retRate,  value: `${returnRate.toFixed(1)}%`,   colorCls: returnRate > 15 ? 'text-red-400' : returnRate > 5 ? 'text-amber-400' : 'text-emerald-400' },
                { label: t.retValue, value: fmtS(returnedRev) },
              ].map(c => (
                <div key={c.label} className="bg-[#1a1a2e] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
                  <p className={`font-bold text-base ${(c as { colorCls?: string }).colorCls ?? 'text-white'}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Return rate bar */}
            <div>
              <p className="text-slate-500 text-xs mb-3">{t.retLevel}</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{t.retAllShops}</span>
                    <span className={returnRate > 15 ? 'text-red-400 font-semibold' : returnRate > 5 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                      {returnRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/[0.05] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${returnRate > 15 ? 'bg-red-500' : returnRate > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(returnRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-slate-600 text-xs">
              {t.retNote}
            </p>
          </div>
        )}
      </Section>

      {/* ── 6. Price Positioning ──────────────────────────────────────────── */}
      <Section title={t.priceTitle} icon={Target}>
        {!hasProducts ? <Empty t={t} /> : (
          <div>
            <div className="flex items-center gap-2 px-5 py-3 bg-blue-500/[0.05] border-b border-blue-500/10">
              <Target className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <p className="text-blue-400/80 text-xs">{t.priceNote}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-[var(--border)] bg-white/[0.01]">
                    <th className="text-left font-medium px-5 py-3">{t.colProductName}</th>
                    <th className="text-right font-medium px-4 py-3">{t.colYourPrice}</th>
                    <th className="text-right font-medium px-4 py-3">{t.colCatAvg}</th>
                    <th className="text-right font-medium px-4 py-3">{t.colDiff2}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {pricePos.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-white font-medium text-xs">{p.title}</p>
                        {p.category && <p className="text-slate-600 text-[10px]">{p.category}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-right text-white text-xs font-semibold">{fmtS(p.price)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-400 text-xs">{fmtS(p.avg)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-bold ${priceDiffCls(p.diff)}`}>
                          {p.diff > 0 ? '+' : ''}{p.diff.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[var(--border)] flex gap-4 text-[10px] text-slate-600">
              <span><span className="text-emerald-400">■</span> {t.legendBelow}</span>
              <span><span className="text-amber-400">■</span> {t.legendAround}</span>
              <span><span className="text-red-400">■</span> {t.legendAbove}</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 7. Best Selling Time ──────────────────────────────────────────── */}
      <Section title={t.timeTitle} icon={Clock}>
        {!hasOrders ? <Empty t={t} /> : (
          <div className="p-5 space-y-6">
            {/* By day of week */}
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-3">{t.byDay}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS_ORD.map(dayIdx => (
                  <div key={dayIdx} className="flex flex-col items-center gap-1">
                    <div className={`w-full rounded-lg py-3 text-center text-xs transition-all ${heatCls(byDay[dayIdx], maxDay)}`}>
                      {byDay[dayIdx]}
                    </div>
                    <span className="text-slate-600 text-[9px] text-center leading-tight">{DAYS_UZ[dayIdx].slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By hour */}
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-3">{t.byHour}</p>
              <div className="grid grid-cols-12 gap-1">
                {byHour.map((count, h) => (
                  <div key={h} className="flex flex-col items-center gap-0.5">
                    <div className={`w-full rounded-md py-2.5 text-center text-[10px] transition-all ${heatCls(count, maxHour)}`}>
                      {count > 0 ? count : ''}
                    </div>
                    <span className="text-slate-700 text-[8px]">{String(h).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader({ isFree, days, t }: { isFree: boolean; days: number; t: AnalyticsT }) {
  const opts = [7, 30, 90, 180] as const
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-violet-400" />
          {t.title}
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">{t.subtitle}</p>
      </div>
      {!isFree && (
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
          {opts.map(d => (
            <Link key={d} href={`?days=${d}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                days === d
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              {d} {t.daysSuffix}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
