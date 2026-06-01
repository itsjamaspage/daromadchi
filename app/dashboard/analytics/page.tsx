import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/api/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart2, TrendingUp, Clock, ShoppingBag, AlertTriangle,
  Target, Calendar, RefreshCw, Lock, ArrowRight, Zap,
} from 'lucide-react'

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}
function fmtS(n: number) { return fmt(n) + " so'm" }

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

function Empty() {
  return (
    <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
      <RefreshCw className="w-5 h-5 opacity-30" />
      Ma&apos;lumotlar sync qilingandan keyin ko&apos;rinadi
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode
}) {
  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function FreeBanner() {
  return (
    <div className="flex items-center gap-3 bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3 text-sm mb-1">
      <Lock className="w-4 h-4 text-violet-400 shrink-0" />
      <span className="text-slate-300">
        Bepul tarif: faqat oxirgi <strong className="text-white">7 kun</strong> ma&apos;lumoti ko&apos;rsatilmoqda.
        Ko&apos;proq tarix uchun&nbsp;
        <Link href="/pricing" className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2">Pro ga o&apos;ting</Link>.
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

// ── Mock campaign data ─────────────────────────────────────────────────────────

const MOCK_CAMPAIGNS = [
  { id: 1, name: 'Bahorgi kampaniya — kiyim',     spend: 8_400_000,  revenue: 42_000_000, drr: 20.0, clicks: 4_200, orders: 98,  roas: 5.0  },
  { id: 2, name: 'Elektronika promo — may',        spend: 12_100_000, revenue: 48_000_000, drr: 25.2, clicks: 2_840, orders: 54,  roas: 3.97 },
  { id: 3, name: 'Krossovka — yangi to\'plam',     spend: 6_800_000,  revenue: 38_500_000, drr: 17.7, clicks: 5_600, orders: 142, roas: 5.66 },
  { id: 4, name: 'Smartfon aksessuar retargeting', spend: 3_200_000,  revenue: 9_800_000,  drr: 32.7, clicks: 1_050, orders: 22,  roas: 3.06 },
  { id: 5, name: 'Yozgi sport kiyim',              spend: 5_500_000,  revenue: 28_200_000, drr: 19.5, clicks: 3_390, orders: 76,  roas: 5.13 },
]

export default async function AnalyticsPage({ searchParams }: Props) {
  const params  = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan   = await getUserPlan(user.id)
  const isFree = plan === 'free'
  const rawDays = Number(params.days) || 30
  const days   = isFree ? 7 : Math.min(Math.max(rawDays, 7), 365)
  const activeTab = (params.tab ?? 'umumiy') as 'umumiy' | 'kampaniyalar' | 'tashqi'

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
        <PageHeader isFree={isFree} days={days} activeTab={activeTab} />
        <div className="bg-[#13131f] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <BarChart2 className="w-10 h-10 text-violet-400/40 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Do&apos;kon ulanmagan</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
            Sozlamalar sahifasiga o&apos;tib, Uzum API tokeningizni kiriting va sinxronizatsiyani boshlang.
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Sozlamalarga o&apos;tish <ArrowRight className="w-4 h-4" />
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
  const DAYS_UZ = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
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
      <PageHeader isFree={isFree} days={days} activeTab={activeTab} />
      {isFree && <FreeBanner />}

      {/* ── Tab: Kampaniyalar ─────────────────────────────────────────────── */}
      {activeTab === 'kampaniyalar' && (
        <Section title="Kampaniyalar" icon={Zap}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                  <th className="text-left font-medium px-5 py-3">Kampaniya nomi</th>
                  <th className="text-right font-medium px-4 py-3">Sarfi</th>
                  <th className="text-right font-medium px-4 py-3">Daromad</th>
                  <th className="text-right font-medium px-4 py-3">DRR</th>
                  <th className="text-right font-medium px-4 py-3">Bosishlar</th>
                  <th className="text-right font-medium px-4 py-3">Buyurtmalar</th>
                  <th className="text-right font-medium px-4 py-3">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {MOCK_CAMPAIGNS.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium text-xs">{c.name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right text-red-400/80 text-xs">−{fmtS(c.spend)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-300 text-xs">{fmtS(c.revenue)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-xs font-bold ${drrCls(c.drr)}`}>{c.drr.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-400 text-xs">{fmt(c.clicks)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-300 text-xs">{c.orders}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-xs font-bold ${c.roas >= 4 ? 'text-emerald-400' : c.roas >= 2.5 ? 'text-amber-400' : 'text-red-400'}`}>
                        {c.roas.toFixed(2)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04] text-xs text-slate-600">
            * Kampaniya ma&apos;lumotlari namunali. Haqiqiy Uzum Ads ma&apos;lumotlari tez orada qo&apos;shiladi.
          </div>
        </Section>
      )}

      {/* ── Tab: Tashqi trafik ────────────────────────────────────────────── */}
      {activeTab === 'tashqi' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Umumiy tashqi trafik', value: '2,847', sub: 'tashrif' },
              { label: "O'rtacha konversiya",  value: '2.8%',   sub: 'barcha manbalar' },
              { label: 'Tashqi buyurtmalar',   value: '79',     sub: 'buyurtma' },
              { label: 'Tashqi tushum',        value: "18,240,000 so'm", sub: 'ushbu davr' },
            ].map(c => (
              <div key={c.label} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-4">
                <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">{c.label}</p>
                <p className="text-white font-bold text-xl">{c.value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Source Breakdown Table */}
          <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-400" />
              <h2 className="text-white font-semibold text-sm">Manba bo&apos;yicha taqsimot</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                    <th className="text-left font-medium px-5 py-3">Manba</th>
                    <th className="text-right font-medium px-4 py-3">Tashriflar</th>
                    <th className="text-right font-medium px-4 py-3">Konversiya</th>
                    <th className="text-right font-medium px-4 py-3">Buyurtmalar</th>
                    <th className="text-right font-medium px-4 py-3">Tushum</th>
                    <th className="text-right font-medium px-4 py-3">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {[
                    { source: 'Instagram', visits: 1282, conv: 2.3, orders: 29, revenue: 6_670_000, trend: '+12%', up: true  },
                    { source: 'Telegram',  visits: 854,  conv: 4.1, orders: 35, revenue: 8_050_000, trend: '+28%', up: true  },
                    { source: 'YouTube',   visits: 427,  conv: 1.8, orders: 7,  revenue: 1_610_000, trend: '-5%',  up: false },
                    { source: 'Blog',      visits: 284,  conv: 3.5, orders: 9,  revenue: 2_070_000, trend: '+7%',  up: true  },
                  ].map(row => (
                    <tr key={row.source} className={`transition-colors ${row.up ? 'hover:bg-emerald-500/[0.03]' : 'bg-red-500/[0.02] hover:bg-red-500/[0.04]'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-6 rounded-full ${row.up ? 'bg-emerald-500/40' : 'bg-red-500/40'}`} />
                          <span className="text-white font-medium text-xs">{row.source}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-300 text-xs">{fmt(row.visits)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-semibold ${row.conv >= 3 ? 'text-emerald-400' : row.conv >= 2 ? 'text-amber-400' : 'text-red-400'}`}>{row.conv}%</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-300 text-xs">{row.orders}</td>
                      <td className="px-4 py-3.5 text-right text-slate-300 text-xs">{fmtS(row.revenue)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {row.up ? '↑' : '↓'}{row.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* UTM Instructions */}
          <div className="flex items-start gap-3 bg-blue-500/[0.07] border border-blue-500/20 rounded-2xl px-5 py-4 text-sm">
            <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-300 font-semibold mb-1">UTM parametrlar qo&apos;shish</p>
              <p className="text-slate-400 text-xs leading-relaxed mb-2">
                Tashqi trafikni kuzatish uchun havolalaringizga UTM parametrlar qo&apos;shing:
              </p>
              <code className="block bg-[#0d0d1a] border border-white/[0.06] rounded-xl px-4 py-2 text-[11px] text-cyan-400 font-mono leading-relaxed">
                https://uzum.uz/product/ID?utm_source=instagram&amp;utm_campaign=nomi
              </code>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Umumiy ───────────────────────────────────────────────────── */}
      {activeTab === 'umumiy' && <>

      {/* ── 1. Sales Funnel ───────────────────────────────────────────────── */}
      <Section title="Sotuv hunisi" icon={TrendingUp}>
        {!hasOrders ? <Empty /> : (
          <div className="p-5">
            <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
              {[
                { label: 'Taassurotlar',    value: '—',              sub: 'Marketplace ma\'lumoti', dim: true },
                { label: 'Mahsulot sahifasi',value: '—',             sub: 'Marketplace ma\'lumoti', dim: true },
                { label: 'Savat',           value: '—',              sub: 'Marketplace ma\'lumoti', dim: true },
                { label: 'Buyurtma',        value: fmt(active.length), sub: fmtS(totalRev),         dim: false },
                { label: 'Foyda',           value: fmtS(totalProfit), sub: `${marginPct.toFixed(1)}% marja`, dim: false },
              ].map((stage, i, arr) => (
                <div key={stage.label} className="flex items-center shrink-0">
                  <div className={`flex flex-col items-center justify-center px-5 py-4 rounded-xl border min-w-[140px] text-center
                    ${stage.dim
                      ? 'bg-white/[0.02] border-white/[0.05]'
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
              * Taassurotlar, sahifa ko&apos;rishlar va savat ma&apos;lumotlari marketplace API orqali qo&apos;shiladi.
            </p>
          </div>
        )}
      </Section>

      {/* ── 2. Product Profit Ranking ─────────────────────────────────────── */}
      <Section title="Mahsulot foydasi reytingi" icon={BarChart2}>
        {!hasProducts ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                  <th className="text-left font-medium px-5 py-3">Mahsulot nomi</th>
                  <th className="text-right font-medium px-4 py-3">Sotuvlar</th>
                  <th className="text-right font-medium px-4 py-3">Daromad</th>
                  <th className="text-right font-medium px-4 py-3">Komissiya (~12%)</th>
                  <th className="text-right font-medium px-4 py-3">Foyda / dona</th>
                  <th className="text-right font-medium px-4 py-3">Rentabellik</th>
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
      <Section title="Haftalik taqqoslash" icon={Calendar}>
        {!hasOrders ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                  <th className="text-left font-medium px-5 py-3">Ko&apos;rsatkich</th>
                  <th className="text-right font-medium px-4 py-3">Bu hafta</th>
                  <th className="text-right font-medium px-4 py-3">O&apos;tgan hafta</th>
                  <th className="text-right font-medium px-4 py-3">Farq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {([
                  { label: 'Buyurtmalar', curr: thisWkStats.orders,  prev: lastWkStats.orders,  isNum: true },
                  { label: 'Daromad',     curr: thisWkStats.revenue, prev: lastWkStats.revenue, isNum: false },
                  { label: 'Foyda',       curr: thisWkStats.profit,  prev: lastWkStats.profit,  isNum: false },
                  { label: 'Qaytarishlar',curr: thisWkStats.returns, prev: lastWkStats.returns, isNum: true },
                ] as { label: string; curr: number; prev: number; isNum: boolean }[]).map(row => {
                  const d = delta(row.curr, row.prev)
                  const isReturns = row.label === 'Qaytarishlar'
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
      <Section title="Reklama samaradorligi" icon={Zap}>
        {!hasProducts ? <Empty /> : (
          <div className="p-5 space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Jami reklama sarfi (taxm.)', value: fmtS(totalAdSpend) },
                { label: 'Jami daromad',               value: fmtS(totalRev) },
                { label: 'DRR (jami)',                  value: `${drrTotal.toFixed(1)}%`, colorCls: drrCls(drrTotal) },
              ].map(c => (
                <div key={c.label} className="bg-[#1a1a2e] border border-white/[0.05] rounded-xl p-3">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
                  <p className={`font-bold text-base ${(c as { colorCls?: string }).colorCls ?? 'text-white'}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-white/[0.05]">
                    <th className="text-left font-medium py-2">Mahsulot</th>
                    <th className="text-right font-medium px-3 py-2">Reklama xarajati</th>
                    <th className="text-right font-medium px-3 py-2">Sotuvlar</th>
                    <th className="text-right font-medium px-3 py-2">Foyda / dona</th>
                    <th className="text-right font-medium px-3 py-2">DRR %</th>
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
                <strong className="text-amber-300">Eslatma:</strong> Reklama xarajati hozircha komissiya asosida taxminiy hisoblanmoqda.
                Real Uzum Ads ma&apos;lumotlari tez orada qo&apos;shiladi.
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 5. Returns Analysis ───────────────────────────────────────────── */}
      <Section title="Qaytarishlar tahlili" icon={ShoppingBag}>
        {!hasOrders ? <Empty /> : (
          <div className="p-5 space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Jami qaytarishlar', value: fmt(returned.length) + ' ta' },
                { label: 'Qaytarish foizi',   value: `${returnRate.toFixed(1)}%`,   colorCls: returnRate > 15 ? 'text-red-400' : returnRate > 5 ? 'text-amber-400' : 'text-emerald-400' },
                { label: 'Qaytarish qiymati', value: fmtS(returnedRev) },
              ].map(c => (
                <div key={c.label} className="bg-[#1a1a2e] border border-white/[0.05] rounded-xl p-3">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
                  <p className={`font-bold text-base ${(c as { colorCls?: string }).colorCls ?? 'text-white'}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Return rate bar */}
            <div>
              <p className="text-slate-500 text-xs mb-3">Qaytarish darajasi (ushbu davr)</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Barcha do&apos;konlar</span>
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
              * Mahsulot bo&apos;yicha qaytarish tahlili uchun buyurtma ↔ mahsulot bog&apos;liqligini API orqali qo&apos;shamiz.
            </p>
          </div>
        )}
      </Section>

      {/* ── 6. Price Positioning ──────────────────────────────────────────── */}
      <Section title="Narx joylashuvi" icon={Target}>
        {!hasProducts ? <Empty /> : (
          <div>
            <div className="flex items-center gap-2 px-5 py-3 bg-blue-500/[0.05] border-b border-blue-500/10">
              <Target className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <p className="text-blue-400/80 text-xs">Raqobatchilar narxi tez orada qo&apos;shiladi — hozircha kategoriya o&apos;rtachasi ko&apos;rsatilmoqda.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                    <th className="text-left font-medium px-5 py-3">Mahsulot nomi</th>
                    <th className="text-right font-medium px-4 py-3">Sizning narxingiz</th>
                    <th className="text-right font-medium px-4 py-3">Kategoriya o&apos;rtachasi</th>
                    <th className="text-right font-medium px-4 py-3">Farq %</th>
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
            <div className="px-5 py-3 border-t border-white/[0.04] flex gap-4 text-[10px] text-slate-600">
              <span><span className="text-emerald-400">■</span> O&apos;rtachadan past (−10%)</span>
              <span><span className="text-amber-400">■</span> O&apos;rtacha atrofida</span>
              <span><span className="text-red-400">■</span> O&apos;rtachadan yuqori (+20%)</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 7. Best Selling Time ──────────────────────────────────────────── */}
      <Section title="Eng yaxshi sotuv vaqti" icon={Clock}>
        {!hasOrders ? <Empty /> : (
          <div className="p-5 space-y-6">
            {/* By day of week */}
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-3">Hafta kunlari bo&apos;yicha</p>
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
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-3">Soat bo&apos;yicha</p>
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

      </>}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type TabKey = 'umumiy' | 'kampaniyalar' | 'tashqi'

function PageHeader({ isFree, days, activeTab }: { isFree: boolean; days: number; activeTab: TabKey }) {
  const opts = [7, 30, 90, 180] as const
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'umumiy',       label: 'Umumiy'        },
    { key: 'kampaniyalar', label: 'Kampaniyalar'  },
    { key: 'tashqi',       label: 'Tashqi trafik' },
  ]
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-violet-400" />
            Kengaytirilgan tahlil
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Sotuv, reklama, qaytarish va vaqt tahlili</p>
        </div>
        {!isFree && activeTab === 'umumiy' && (
          <div className="flex items-center gap-1.5 p-1 bg-[#13131f] border border-white/[0.06] rounded-xl w-fit">
            {opts.map(d => (
              <Link key={d} href={`?days=${d}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  days === d
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                {d} kun
              </Link>
            ))}
          </div>
        )}
      </div>
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-[#13131f] border border-white/[0.06] rounded-xl w-fit">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`?tab=${t.key}${activeTab === 'umumiy' && days !== 30 ? `&days=${days}` : ''}`}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
