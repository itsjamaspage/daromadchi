'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownUp, CalendarClock, CreditCard, Lock,
  TrendingUp, UserMinus, UserPlus, Users, Wallet,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { adminT } from '@/lib/adminT'
import { formatSomFromTiyin } from '@/lib/billing/plans'
import type {
  AdminAnalytics, ChurnReason, PaymentState,
} from '@/lib/db/admin-analytics'

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

function planLabel(plan: string): string {
  return plan === 'pro_plus' ? 'Pro+' : plan === 'pro' ? 'Pro' : plan
}

export default function AdminClient({ data }: { data: AdminAnalytics }) {
  const { lang } = useLang()
  const t = (k: keyof typeof adminT) => adminT[k][lang]
  const locale = LOCALES[lang] ?? 'uz-UZ'
  const [sortAsc, setSortAsc] = useState(true)

  const som = (tiyin: number) => `${formatSomFromTiyin(tiyin)} ${t('som')}`
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const { metrics, activeSubscribers, recentPayments, churned } = data

  // The server hands rows back soonest-renewal-first; flipping is a pure reverse.
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

  const cards = [
    { key: 'mrr',          label: t('mrr'),          value: som(metrics.mrrTiyin),          hint: t('mrrHint'),                                       icon: TrendingUp, accent: 'text-[var(--c1)]' },
    { key: 'arr',          label: t('arr'),          value: som(metrics.arrTiyin),          hint: null,                                               icon: CalendarClock, accent: 'text-[var(--text-base)]' },
    { key: 'total',        label: t('totalRevenue'), value: som(metrics.totalRevenueTiyin), hint: `${metrics.paidPaymentCount} ${t('paymentsCount')}`, icon: Wallet, accent: 'text-emerald-500' },
    { key: 'month',        label: t('monthRevenue'), value: som(metrics.monthRevenueTiyin), hint: null,                                               icon: CreditCard, accent: 'text-emerald-500' },
    { key: 'active',       label: t('activeSubs'),   value: String(metrics.activeCount),    hint: `Pro ${metrics.byPlan.pro.count} · Pro+ ${metrics.byPlan.pro_plus.count}`, icon: Users, accent: 'text-[var(--text-base)]' },
    { key: 'new',          label: t('newThisMonth'), value: String(metrics.newThisMonth),   hint: null,                                               icon: UserPlus, accent: 'text-emerald-500' },
    { key: 'churn',        label: t('churnedMonth'), value: String(metrics.churnedThisMonth), hint: null,                                             icon: UserMinus, accent: metrics.churnedThisMonth > 0 ? 'text-red-500' : 'text-[var(--text-base)]' },
    { key: 'pastdue',      label: t('pastDue'),      value: String(metrics.pastDueCount),   hint: t('pastDueHint'),                                   icon: AlertTriangle, accent: metrics.pastDueCount > 0 ? 'text-amber-500' : 'text-[var(--text-base)]' },
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

      {/* Read-only banner — this dashboard reports, it never acts. */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-card2)] border border-dashed border-[var(--border)]">
        <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">{t('readOnlyNote')}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ key, label, value, hint, icon: Icon, accent }) => (
          <div key={key} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <Icon className={`w-4 h-4 ${accent} opacity-60 flex-shrink-0`} />
            </div>
            <p className={`text-lg font-bold break-words ${accent}`}>{value}</p>
            {hint && <p className="text-[10px] text-[var(--text-muted)] mt-1">{hint}</p>}
          </div>
        ))}
      </div>

      {/* Splits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SplitCard
          title={t('byPlan')}
          unit={t('subsUnit')}
          rows={[
            { label: t('planPro'),     ...metrics.byPlan.pro },
            { label: t('planProPlus'), ...metrics.byPlan.pro_plus },
          ]}
          som={som}
        />
        <SplitCard
          title={t('byInterval')}
          unit={t('subsUnit')}
          rows={[
            { label: t('monthly'), ...metrics.byInterval.monthly },
            { label: t('annual'),  ...metrics.byInterval.annual },
          ]}
          som={som}
        />
      </div>

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
              <Th>{t('colEmail')}</Th>
              <Th>{t('colPlan')}</Th>
              <Th>{t('colInterval')}</Th>
              <Th>{t('colAmount')}</Th>
              <Th>{t('colMrr')}</Th>
              <Th>{t('colStarted')}</Th>
              <Th>{t('colPeriodEnd')}</Th>
              <Th>{t('colAutorenew')}</Th>
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
      <Panel
        title={t('paymentsTitle')}
        count={recentPayments.length}
        empty={recentPayments.length === 0 ? t('emptyPayments') : null}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <Th>{t('colDate')}</Th>
              <Th>{t('colEmail')}</Th>
              <Th>{t('colPlan')}</Th>
              <Th>{t('colInterval')}</Th>
              <Th>{t('colAmount')}</Th>
              <Th>{t('colStatus')}</Th>
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
      <Panel
        title={t('churnedTitle')}
        count={churned.length}
        empty={churned.length === 0 ? t('emptyChurned') : null}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <Th>{t('colEmail')}</Th>
              <Th>{t('colPlan')}</Th>
              <Th>{t('colInterval')}</Th>
              <Th>{t('colLapsed')}</Th>
              <Th>{t('colReason')}</Th>
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

/* ── small building blocks ──────────────────────────────────────────────────── */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-xs text-[var(--text-dim)] ${className}`}>{children}</td>
}

function SplitCard({
  title, unit, rows, som,
}: {
  title: string
  unit: string
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
  title: string
  count: number
  children: React.ReactNode
  empty: string | null
  action?: React.ReactNode
}) {
  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
        <p className="text-xs font-semibold text-[var(--text-muted)]">{title}</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--border)] text-[var(--c1)]">
          {count}
        </span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {empty
        ? <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{empty}</div>
        : <div className="overflow-x-auto">{children}</div>}
    </div>
  )
}
