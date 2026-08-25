'use client'

import { useMemo, useState } from 'react'
import {
  Area, AreaChart, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowDownRight, ArrowDownUp, ArrowUpRight, CalendarClock, Clock,
  CreditCard, Gauge, Lock, TrendingUp, UserCheck, UserMinus, UserPlus, Users, Wallet,
} from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'
import { adminT } from '@/lib/adminT'
import { formatSomFromTiyin } from '@/lib/billing/plans'
import type {
  AdminAnalytics, ChurnReason, MrrPoint, PaymentState,
} from '@/lib/db/admin-analytics'

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

const PLAN_META = [
  { key: 'pro' as const,      label: 'Pro',    color: '#6366f1' },
  { key: 'pro_plus' as const, label: 'Pro+',   color: '#8b5cf6' },
  { key: 'biznes' as const,   label: 'Biznes', color: '#ec4899' },
]

// Only month-boundary views are meaningful (the series is derived from
// timestamps, not an intra-day MRR curve), so the toggle is 12M · 24M · custom.
const RANGES = [
  { key: '12M', months: 12 },
  { key: '24M', months: 24 },
] as const

function planLabel(plan: string): string {
  return plan === 'pro_plus' ? 'Pro+' : plan === 'pro' ? 'Pro' : plan === 'biznes' ? 'Biznes' : plan
}

// tiyin → compact so'm axis label (12.5M / 320K / 900).
function shortSom(tiyin: number): string {
  const som = tiyin / 100
  const a = Math.abs(som)
  if (a >= 1_000_000) return `${(som / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${Math.round(som / 1_000)}K`
  return `${Math.round(som)}`
}

function TrendChip({ pct, invert = false, suffix }: { pct: number | null; invert?: boolean; suffix?: string }) {
  if (pct === null) return <span className="text-[10px] text-[var(--text-muted)]">—</span>
  const up = pct >= 0
  const good = invert ? !up : up   // for churn, up = worse
  const color = pct === 0 ? 'text-[var(--text-muted)]' : good ? 'text-emerald-500' : 'text-red-500'
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${color}`}>
      <Icon className="w-3 h-3" />{up ? '+' : ''}{pct}%
      {suffix ? <span className="text-[var(--text-muted)] font-normal ml-0.5">{suffix}</span> : null}
    </span>
  )
}

/** Stripe-style KPI tile: label + icon, big number, sub-line with MoM trend,
 *  and a real monthly sparkline bleeding to the card's bottom edge. */
function SparkCard({
  label, value, sub, series, dataKey, color, icon: Icon, trend, invert, money,
}: {
  label: string
  value: string
  sub: string
  series: MrrPoint[] | AdminAnalytics['usersSeriesMonthly']
  dataKey: string
  color: string
  icon: React.ComponentType<{ className?: string }>
  trend: number | null
  invert: boolean
  money: boolean
}) {
  const gradId = `spark-${dataKey}-${color.replace('#', '')}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasData = series.some(d => Number((d as any)[dataKey]) > 0)
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card2)] flex flex-col min-h-[132px]">
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[var(--text-muted)] truncate">{label}</span>
          <Icon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
        </div>
        <p className="mt-1.5 text-2xl font-bold leading-tight text-[var(--text-base)] break-words tabular-nums">{value}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {trend !== null && <TrendChip pct={trend} invert={invert} />}
          <span className="text-[11px] text-[var(--text-muted)] truncate">{sub}</span>
        </div>
      </div>
      <div className="mt-auto h-12 w-full">
        {hasData && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series as unknown as MrrPoint[]} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={false}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => (active && payload?.length) ? (
                  <div className="border rounded-lg px-2.5 py-1.5 shadow-xl" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{payload[0].payload.label}</p>
                    <p className="text-xs font-bold" style={{ color }}>
                      {money ? formatSomFromTiyin(Number(payload[0].value)) : payload[0].value}
                    </p>
                  </div>
                ) : null}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.75} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default function AdminClient({ data }: { data: AdminAnalytics }) {
  const { lang } = useLang()
  const { theme } = useTheme()
  const t = (k: keyof typeof adminT) => adminT[k][lang]
  const locale = LOCALES[lang] ?? 'uz-UZ'
  const [sortAsc, setSortAsc] = useState(true)

  const som = (tiyin: number) => `${formatSomFromTiyin(tiyin)} ${t('som')}`
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const { metrics, activeSubscribers, recentPayments, churned, byPlanTrend } = data

  const sortedActive = useMemo(
    () => (sortAsc ? activeSubscribers : [...activeSubscribers].reverse()),
    [activeSubscribers, sortAsc],
  )

  const stateLabel: Record<PaymentState, string> = {
    paid: t('statusPaid'), pending: t('statusPending'),
    failed: t('statusFailed'), cancelled: t('statusCancelled'),
  }
  const stateCls: Record<PaymentState, string> = {
    paid:      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    pending:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
    failed:    'bg-red-500/10 text-red-500 border-red-500/20',
    cancelled: 'bg-[var(--bg-card2)] text-[var(--text-muted)] border-[var(--border)]',
  }
  const reasonLabel: Record<ChurnReason, string> = {
    cancelled: t('reasonCancelled'), expired: t('reasonExpired'), lapsed: t('reasonLapsed'),
  }
  const email = (v: string | null) =>
    v ?? <span className="italic text-[var(--text-muted)]">{t('noEmail')}</span>

  const nf = new Intl.NumberFormat(locale)
  const monthly = data.mrrSeriesMonthly
  const usersMonthly = data.usersSeriesMonthly

  // Fallback MoM trend read straight off a spark series' last two buckets — used
  // for cards whose exact month-boundary trend isn't precomputed server-side.
  const sparkTrend = (series: MrrPoint[] | AdminAnalytics['usersSeriesMonthly'], key: string): number | null => {
    if (series.length < 2) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const curr = Number((series[series.length - 1] as any)[key])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = Number((series[series.length - 2] as any)[key])
    return prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null
  }

  // ── hero spark cards — big number + real monthly sparkline ──
  const heroCards = [
    { key: 'mrr',     label: t('cardMrr'),        value: som(metrics.mrrTiyin),               sub: t('subMrr'),   series: monthly,      dataKey: 'mrrTiyin',       color: '#10b981', icon: TrendingUp, trend: metrics.mrrTrendPct,               invert: false, money: true  },
    { key: 'active',  label: t('cardActiveSubs'), value: nf.format(metrics.activeCount),      sub: t('subTotal'), series: monthly,      dataKey: 'activeCount',    color: '#22c55e', icon: UserCheck,  trend: metrics.activeTrendPct,            invert: false, money: false },
    { key: 'revenue', label: t('cardRevenue'),    value: som(metrics.monthRevenueTiyin),      sub: t('subMonth'), series: monthly,      dataKey: 'collectedTiyin', color: '#14b8a6', icon: Wallet,     trend: sparkTrend(monthly, 'collectedTiyin'), invert: false, money: true  },
    { key: 'newsubs', label: t('cardNewSubs'),    value: nf.format(metrics.newThisMonth),     sub: t('subMonth'), series: monthly,      dataKey: 'newCount',       color: '#6366f1', icon: CreditCard, trend: sparkTrend(monthly, 'newCount'),   invert: false, money: false },
    { key: 'signups', label: t('cardSignups'),    value: nf.format(metrics.newUsersThisMonth), sub: t('subMonth'), series: usersMonthly, dataKey: 'newUsers',       color: '#3b82f6', icon: UserPlus,   trend: sparkTrend(usersMonthly, 'newUsers'), invert: false, money: false },
    { key: 'users',   label: t('cardUsers'),      value: nf.format(metrics.totalUsers),       sub: t('subTotal'), series: usersMonthly, dataKey: 'totalUsers',     color: '#0ea5e9', icon: Users,      trend: sparkTrend(usersMonthly, 'totalUsers'), invert: false, money: false },
  ]

  // ── secondary stat cards (no spark) ──
  const statCards = [
    { key: 'arr',     label: t('arr'),            value: som(metrics.arrTiyin),          hint: null,               icon: CalendarClock, accent: 'text-[var(--text-base)]', trend: null,                    invert: false },
    { key: 'churn',   label: t('kpiChurn'),       value: `${metrics.churnRatePct}%`,     hint: t('vsLastMonth'),   icon: UserMinus,     accent: metrics.churnRatePct > 0 ? 'text-red-500' : 'text-[var(--text-base)]', trend: metrics.churnTrendPct, invert: true },
    { key: 'trial',   label: t('trialNotPaying'), value: nf.format(metrics.trialUsers),  hint: null,               icon: Clock,         accent: 'text-amber-500',          trend: null,                    invert: false },
    { key: 'pastdue', label: t('pastDue'),        value: nf.format(metrics.pastDueCount), hint: t('pastDueHint'),  icon: Gauge,         accent: metrics.pastDueCount > 0 ? 'text-amber-500' : 'text-[var(--text-base)]', trend: null, invert: false },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Lock className="w-4 h-4 text-[var(--c1)]" />
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{t('title')}</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{t('subtitle')}</p>
        </div>
        <p className="text-xs text-[var(--text-muted)] ml-auto whitespace-nowrap pt-1">
          {t('updatedAt')}: {new Date(data.generatedAt).toLocaleString(locale)}
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-card2)] border border-dashed border-[var(--border)]">
        <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">{t('readOnlyNote')}</p>
      </div>

      {/* Hero spark cards — big number + real monthly sparkline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {heroCards.map(({ key, ...c }) => (
          <SparkCard key={key} {...c} />
        ))}
      </div>

      {/* Secondary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ key, label, value, hint, icon: Icon, accent, trend, invert }) => (
          <div key={key} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <Icon className={`w-4 h-4 ${accent} opacity-60 flex-shrink-0`} />
            </div>
            <p className={`text-lg font-bold break-words ${accent}`}>{value}</p>
            {(trend !== null || hint) && (
              <div className="mt-1.5 flex items-center gap-1">
                {trend !== null && <TrendChip pct={trend} invert={invert} />}
                {hint && <span className="text-[10px] text-[var(--text-muted)]">{hint}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MRR growth vs churn — centerpiece */}
      <MrrChart
        monthly={data.mrrSeriesMonthly}
        daily={data.mrrSeriesDaily}
        theme={theme}
        t={t}
      />

      {/* New subscriptions + plan share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <NewSubsChart data={data.newSubsDaily} theme={theme} t={t} />
        <PlanShareBar byPlan={metrics.byPlan} trend={byPlanTrend} som={som} t={t} />
      </div>

      {/* Funnel */}
      <Funnel
        title={t('funnelTitle')}
        note={t('funnelNote')}
        ofRegistered={t('ofRegistered')}
        locale={locale}
        stages={[
          { label: t('funnelRegistered'), value: metrics.totalUsers },
          { label: t('funnelPaidPlan'),   value: metrics.paidPlanUsers },
          { label: t('funnelActive'),     value: metrics.activeCount },
        ]}
      />

      {/* Interval split */}
      <SplitCard
        title={t('byInterval')}
        unit={t('subsUnit')}
        rows={[
          { label: t('monthly'), ...metrics.byInterval.monthly },
          { label: t('annual'),  ...metrics.byInterval.annual },
        ]}
        som={som}
      />

      {/* Active subscribers */}
      <Panel
        title={t('activeTitle')}
        count={activeSubscribers.length}
        action={
          activeSubscribers.length > 1 ? (
            <button
              onClick={() => setSortAsc(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors"
            >
              <ArrowDownUp className="w-3 h-3" />
              {sortAsc ? t('sortAsc') : t('sortDesc')}
            </button>
          ) : null
        }
        empty={activeSubscribers.length === 0 ? t('emptyActive') : null}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <Th>{t('colEmail')}</Th><Th>{t('colPlan')}</Th><Th>{t('colInterval')}</Th>
              <Th>{t('colAmount')}</Th><Th>{t('colMrr')}</Th><Th>{t('colStarted')}</Th>
              <Th>{t('colPeriodEnd')}</Th><Th>{t('colAutorenew')}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sortedActive.map(s => (
              <tr key={s.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                <Td className="text-[var(--text-base)] font-medium">{email(s.email)}</Td>
                <Td>{planLabel(s.plan)}</Td>
                <Td>{s.interval === 'annual' ? t('annual') : t('monthly')}</Td>
                <Td className="whitespace-nowrap">{som(s.amountTiyin)}</Td>
                <Td className="whitespace-nowrap text-[var(--c1)] font-semibold">{som(s.mrrTiyin)}</Td>
                <Td className="whitespace-nowrap">{date(s.startedAt)}</Td>
                <Td className="whitespace-nowrap">{date(s.periodEnd)}</Td>
                <Td>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    s.autorenew
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-[var(--bg-card2)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}>
                    {s.autorenew ? t('on') : t('off')}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Recent payments */}
      <Panel title={t('paymentsTitle')} count={recentPayments.length} empty={recentPayments.length === 0 ? t('emptyPayments') : null}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <Th>{t('colDate')}</Th><Th>{t('colEmail')}</Th><Th>{t('colPlan')}</Th>
              <Th>{t('colInterval')}</Th><Th>{t('colAmount')}</Th><Th>{t('colStatus')}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {recentPayments.map(p => (
              <tr key={p.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                <Td className="whitespace-nowrap">{date(p.date)}</Td>
                <Td className="text-[var(--text-base)] font-medium">{email(p.email)}</Td>
                <Td>{planLabel(p.plan)}</Td>
                <Td>{p.interval === 'annual' ? t('annual') : t('monthly')}</Td>
                <Td className="whitespace-nowrap">{som(p.amountTiyin)}</Td>
                <Td>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stateCls[p.state]}`}>
                    {stateLabel[p.state]}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Churned */}
      <Panel title={t('churnedTitle')} count={churned.length} empty={churned.length === 0 ? t('emptyChurned') : null}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <Th>{t('colEmail')}</Th><Th>{t('colPlan')}</Th><Th>{t('colInterval')}</Th>
              <Th>{t('colLapsed')}</Th><Th>{t('colReason')}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {churned.map(c => (
              <tr key={c.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                <Td className="text-[var(--text-base)] font-medium">{email(c.email)}</Td>
                <Td>{planLabel(c.plan)}</Td>
                <Td>{c.interval === 'annual' ? t('annual') : t('monthly')}</Td>
                <Td className="whitespace-nowrap">{date(c.lapsedAt)}</Td>
                <Td>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[var(--bg-card2)] text-[var(--text-muted)] border-[var(--border)]">
                    {reasonLabel[c.reason]}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

/* ── charts ──────────────────────────────────────────────────────────────────── */

type Tf = (k: keyof typeof adminT) => string

function chartColors(theme: string) {
  const dark = theme === 'dark'
  return {
    axis: dark ? '#64748b' : '#9ca3af',
    grid: dark ? '#ffffff10' : '#eef1f5',
    cursor: dark ? '#ffffff08' : '#f2f4f7',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MoneyTooltip({ active, payload, label, rows }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="border rounded-xl px-3 py-2 shadow-xl" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
      <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs font-semibold" style={{ color: p.color }}>
          {rows[p.dataKey] ?? p.dataKey}: {formatSomFromTiyin(Math.abs(Number(p.value)))} so&apos;m
        </p>
      ))}
    </div>
  )
}

function MrrChart({ monthly, daily, theme, t }: { monthly: MrrPoint[]; daily: MrrPoint[]; theme: string; t: Tf }) {
  const [range, setRange] = useState<string>('12M')   // '12M' | '24M' | 'custom'
  const [pickOpen, setPickOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const c = chartColors(theme)

  const data = useMemo(() => {
    if (range === 'custom' && from && to) {
      const spanDays = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
      // Wide spans read as months; a short window (≤ ~3 months) uses the daily
      // series so it isn't a single flat point.
      if (spanDays > 92) {
        const fromYM = from.slice(0, 7), toYM = to.slice(0, 7)
        return monthly.filter(p => p.key >= fromYM && p.key <= toYM)
      }
      return daily.filter(p => p.key >= from && p.key <= to)
    }
    return monthly.slice(range === '24M' ? -24 : -12)
  }, [range, from, to, monthly, daily])

  const hasData = data.some(d => d.newMrrTiyin > 0 || d.churnedMrrTiyin > 0)
  const rowLabels = { newMrrTiyin: t('seriesNewMrr'), churnedMrrTiyin: t('seriesChurned') }
  const btn = (activeState: boolean) => ({
    background: activeState ? 'var(--bg-input)' : 'transparent',
    borderColor: 'var(--border)',
    color: activeState ? 'var(--c1)' : 'var(--text-muted)',
  })
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)', colorScheme: 'light' as const }

  return (
    <div className="border rounded-2xl p-5 bg-[var(--bg-card2)]" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-[var(--text-base)]">{t('mrrGrowthTitle')}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('mrrGrowthSub')}</p>
        </div>
        <div className="relative flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => { setRange(r.key); setPickOpen(false) }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
              style={btn(range === r.key)}
            >
              {r.key}
            </button>
          ))}
          <button
            onClick={() => setPickOpen(o => !o)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1"
            style={btn(range === 'custom')}
          >
            <CalendarClock className="w-3 h-3" />
            {range === 'custom' && from && to ? `${from.slice(5)} — ${to.slice(5)}` : t('rangeCustom')}
          </button>
          {pickOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border shadow-2xl p-3 space-y-2"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: 220 }}>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{t('rangeFrom')}</span>
                <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm border outline-none" style={inputStyle} />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{t('rangeTo')}</span>
                <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm border outline-none" style={inputStyle} />
              </label>
              <button
                onClick={() => { if (from && to) { setRange('custom'); setPickOpen(false) } }}
                disabled={!from || !to}
                className="w-full py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--c1)', color: '#131321' }}
              >
                {t('rangeApply')}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#10b981' }} />{t('seriesNewMrr')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#ef4444' }} />{t('seriesChurned')}
        </span>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis tickFormatter={shortSom} tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<MoneyTooltip rows={rowLabels} />} cursor={{ stroke: c.cursor, strokeWidth: 24 }} />
            <Line type="monotone" dataKey="newMrrTiyin" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="churnedMrrTiyin" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex items-center justify-center text-sm text-[var(--text-muted)]">{t('emptyChart')}</div>
      )}
      <p className="text-[10px] text-[var(--text-muted)] mt-3 leading-relaxed">{t('chartCaveat')}</p>
    </div>
  )
}

function NewSubsChart({ data, theme, t }: { data: { key: string; label: string; count: number }[]; theme: string; t: Tf }) {
  const c = chartColors(theme)
  const hasData = data.some(d => d.count > 0)
  return (
    <div className="border rounded-2xl p-5 bg-[var(--bg-card2)]" style={{ borderColor: 'var(--border)' }}>
      <h3 className="font-semibold text-[var(--text-base)]">{t('newSubsTitle')}</h3>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-4">{t('newSubsSub')}</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip cursor={{ fill: c.cursor }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload, label }: any) => (active && payload?.length) ? (
                <div className="border rounded-xl px-3 py-2 shadow-xl" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-base)' }}>{payload[0].value}</p>
                </div>
              ) : null}
            />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-sm text-[var(--text-muted)]">{t('emptyChart')}</div>
      )}
    </div>
  )
}

function PlanShareBar({
  byPlan, trend, som, t,
}: {
  byPlan: AdminAnalytics['metrics']['byPlan']
  trend: AdminAnalytics['byPlanTrend']
  som: (tiyin: number) => string
  t: Tf
}) {
  const total = PLAN_META.reduce((s, p) => s + byPlan[p.key].mrrTiyin, 0)
  return (
    <div className="border rounded-2xl p-5 bg-[var(--bg-card2)]" style={{ borderColor: 'var(--border)' }}>
      <h3 className="font-semibold text-[var(--text-base)] mb-4">{t('planShareTitle')}</h3>
      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4" style={{ background: 'var(--border)' }}>
        {PLAN_META.map(p => {
          const share = total > 0 ? (byPlan[p.key].mrrTiyin / total) * 100 : 0
          return share > 0 ? <div key={p.key} style={{ width: `${share}%`, background: p.color }} title={`${p.label}: ${share.toFixed(1)}%`} /> : null
        })}
        {total === 0 && <div className="w-full" />}
      </div>
      <div className="space-y-2.5">
        {PLAN_META.map(p => {
          const share = total > 0 ? (byPlan[p.key].mrrTiyin / total) * 100 : 0
          return (
            <div key={p.key} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }} />
              <span className="text-sm text-[var(--text-base)]">{p.label}</span>
              <TrendChip pct={trend[p.key]} />
              <span className="text-xs text-[var(--text-muted)] ml-auto">
                {byPlan[p.key].count} · {share.toFixed(0)}% · <span className="text-[var(--c1)] font-semibold">{som(byPlan[p.key].mrrTiyin)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── small building blocks ──────────────────────────────────────────────────── */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-xs text-[var(--text-dim)] ${className}`}>{children}</td>
}

function Funnel({
  title, note, ofRegistered, locale, stages,
}: {
  title: string; note: string; ofRegistered: string; locale: string
  stages: { label: string; value: number }[]
}) {
  const base = stages[0]?.value ?? 0
  const pctOf = (v: number) => (base > 0 ? Math.round((v / base) * 100) : 0)
  const nf = new Intl.NumberFormat(locale)
  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
      <p className="text-xs font-semibold text-[var(--text-muted)] mb-4">{title}</p>
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-stretch gap-2 flex-1">
            <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
              <p className="text-xl font-bold text-[var(--text-base)]">{nf.format(s.value)}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {i === 0 ? '100%' : `${pctOf(s.value)}% ${ofRegistered}`}
              </p>
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center text-[var(--text-muted)] font-bold select-none">→</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-3">{note}</p>
    </div>
  )
}

function SplitCard({
  title, unit, rows, som,
}: {
  title: string; unit: string
  rows: { label: string; count: number; mrrTiyin: number }[]
  som: (tiyin: number) => string
}) {
  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
      <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">{title}</p>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--text-base)]">{r.label}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {r.count} {unit} · <span className="text-[var(--c1)] font-semibold">{som(r.mrrTiyin)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Panel({
  title, count, children, empty, action,
}: {
  title: string; count: number; children: React.ReactNode; empty: string | null; action?: React.ReactNode
}) {
  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
        <p className="text-xs font-semibold text-[var(--text-muted)]">{title}</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--border)] text-[var(--c1)]">{count}</span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {empty
        ? <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{empty}</div>
        : <div className="overflow-x-auto">{children}</div>}
    </div>
  )
}
