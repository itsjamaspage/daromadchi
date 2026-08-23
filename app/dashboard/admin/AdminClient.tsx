'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowDownRight, ArrowDownUp, ArrowUpRight, CalendarClock, Clock,
  Lock, TrendingUp, UserCheck, UserMinus, UserPlus, Users, Wallet,
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

const RANGES = [
  { key: '1D',  days: 1 },
  { key: '7D',  days: 7 },
  { key: '30D', days: 30 },
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

  // ── top KPI cards (value + MoM trend) ──
  const kpis = [
    { key: 'mrr',    label: t('mrr'),        value: som(metrics.mrrTiyin),      trend: metrics.mrrTrendPct,    invert: false, icon: TrendingUp,   accent: 'text-[var(--c1)]' },
    { key: 'active', label: t('activeSubs'), value: String(metrics.activeCount), trend: metrics.activeTrendPct, invert: false, icon: UserCheck,   accent: 'text-emerald-500' },
    { key: 'arr',    label: t('arr'),        value: som(metrics.arrTiyin),      trend: metrics.mrrTrendPct,    invert: false, icon: CalendarClock, accent: 'text-[var(--text-base)]' },
    { key: 'churn',  label: t('kpiChurn'),   value: `${metrics.churnRatePct}%`, trend: metrics.churnTrendPct,  invert: true,  icon: UserMinus,   accent: metrics.churnRatePct > 0 ? 'text-red-500' : 'text-[var(--text-base)]' },
  ]

  // ── secondary user-base cards ──
  const baseCards = [
    { key: 'registered', label: t('registered'), value: String(metrics.totalUsers),        hint: t('registeredHint'), icon: Users,   accent: 'text-[var(--text-base)]' },
    { key: 'signups',    label: t('newSignups'), value: String(metrics.newUsersThisMonth),  hint: null,                icon: UserPlus, accent: 'text-[var(--text-base)]' },
    { key: 'trial',      label: t('trialNotPaying'), value: String(metrics.trialUsers),     hint: null,                icon: Clock,    accent: 'text-amber-500' },
    { key: 'month',      label: t('monthRevenue'), value: som(metrics.monthRevenueTiyin),   hint: `${t('totalRevenue')}: ${som(metrics.totalRevenueTiyin)}`, icon: Wallet, accent: 'text-emerald-500' },
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

      {/* Top KPI cards with MoM trend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ key, label, value, trend, invert, icon: Icon, accent }) => (
          <div key={key} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <Icon className={`w-4 h-4 ${accent} opacity-60 flex-shrink-0`} />
            </div>
            <p className={`text-xl font-bold break-words ${accent}`}>{value}</p>
            <div className="mt-1.5 flex items-center gap-1">
              <TrendChip pct={trend} invert={invert} />
              <span className="text-[10px] text-[var(--text-muted)]">{t('vsLastMonth')}</span>
            </div>
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

      {/* User-base cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {baseCards.map(({ key, label, value, hint, icon: Icon, accent }) => (
          <div key={key} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <Icon className={`w-4 h-4 ${accent} opacity-60 flex-shrink-0`} />
            </div>
            <p className={`text-lg font-bold break-words ${accent}`}>{value}</p>
            {hint && <p className="text-[10px] text-[var(--text-muted)] mt-1">{hint}</p>}
          </div>
        ))}
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
  const [range, setRange] = useState<string>('12M')
  const c = chartColors(theme)
  const active = RANGES.find(r => r.key === range) ?? RANGES[3]
  const data = useMemo(() => {
    if ('months' in active) return monthly.slice(-active.months)
    return daily.slice(-active.days)
  }, [active, monthly, daily])
  const hasData = data.some(d => d.newMrrTiyin > 0 || d.churnedMrrTiyin > 0)
  const rowLabels = { newMrrTiyin: t('seriesNewMrr'), churnedMrrTiyin: t('seriesChurned') }

  return (
    <div className="border rounded-2xl p-5 bg-[var(--bg-card2)]" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-[var(--text-base)]">{t('mrrGrowthTitle')}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('mrrGrowthSub')}</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
              style={{
                background: range === r.key ? 'var(--bg-input)' : 'transparent',
                borderColor: 'var(--border)',
                color: range === r.key ? 'var(--c1)' : 'var(--text-muted)',
              }}
            >
              {r.key}
            </button>
          ))}
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
