'use client'

import { useState, useRef, Fragment } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import type { PayoutEntry, PayoutOrderItem, MarketplaceType } from '@/lib/types'
import ExportButton from '@/components/dashboard/ExportButton'
import MpBadge from '@/components/dashboard/MpBadge'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

// Format a "2026-07" bucket key into "Июль 2026" / "July 2026" /
// "Iyul 2026" and a human date range ("1–31 июля 2026"). Cleaner than
// leaving the raw YYYY-MM string in the UI.
function formatPeriod(period: string, locale: string): { label: string; range: string } {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return { label: period, range: '' }
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0)) // day 0 of next month = last day of this month
  const monthName = first.toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })
  const label = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}`
  const firstDay = first.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' })
  const lastDay = last.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const range = `${firstDay}–${lastDay}`
  return { label, range }
}

interface Props {
  entries: PayoutEntry[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + ' so\'m'
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' mln'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + ' ming'
  return String(n)
}

function StatusBadge({ status }: { status: PayoutEntry['status'] }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  if (status === 'paid') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        {t.statusPaid}
      </span>
    )
  }
  if (status === 'estimated_paid') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/10">
        ≈ {t.statusPaid}
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        {t.statusProcessing}
      </span>
    )
  }
  if (status === 'estimated_pending') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-card2)] text-[var(--text-muted)] border border-dashed border-[var(--border)]">
        ≈ {t.statusPending}
      </span>
    )
  }
  return (
    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-card2)] text-[var(--text-muted)] border border-[var(--border)]">
      {t.statusPending}
    </span>
  )
}

function ItemBreakdown({ items }: { items: PayoutOrderItem[] }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <p className="text-[var(--text-muted)] text-xs">{t.itemsEmpty}</p>
      </div>
    )
  }

  const INITIAL = 5
  const visible = expanded ? items : items.slice(0, INITIAL)
  const hidden = items.length - INITIAL

  return (
    <div className="px-5 py-4 border-t border-[var(--border)] space-y-2">
      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
        {t.itemsTitle} · {items.length}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border)]">
            <th className="text-left font-medium py-2">{t.itemProduct}</th>
            <th className="text-right font-medium py-2">{t.itemQty}</th>
            <th className="text-right font-medium py-2">{t.itemRevenue}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, i) => (
            <tr key={`${item.sku ?? item.productTitle}-${i}`} className="border-b border-[var(--border)] last:border-b-0">
              <td className="py-2 pr-3">
                <div className="text-[var(--text-base)] font-medium leading-tight">{item.productTitle}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.sku && <span className="text-[var(--text-muted)] text-xs font-mono">{item.sku}</span>}
                  <span className="text-[var(--text-muted)] text-xs">· {item.orderCount} {t.itemOrders}</span>
                </div>
              </td>
              <td className="py-2 text-right text-[var(--text-dim)] tabular-nums">×{item.qty}</td>
              <td className="py-2 text-right text-[var(--text-base)] font-medium tabular-nums">{fmt(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--c1)' }}
        >
          {expanded ? t.itemsShowLess : `${t.itemsShowMore} (+${hidden})`}
        </button>
      )}
    </div>
  )
}

function DeductionBar({ entry }: { entry: PayoutEntry }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const total = entry.commission + entry.delivery + entry.returns + entry.adSpend + entry.acquiring + entry.tax + entry.penalty + entry.storageFee + entry.additionalPayment + entry.otherDeductions
  if (total === 0) return null

  const segments = [
    { label: t.segCommission, value: entry.commission,        color: 'bg-violet-500' },
    { label: t.segDelivery,   value: entry.delivery,          color: 'bg-blue-500'   },
    { label: t.segReturns,    value: entry.returns,           color: 'bg-red-500'    },
    { label: t.segAd,         value: entry.adSpend,           color: 'bg-amber-500'  },
    { label: t.segAcquiring,  value: entry.acquiring,         color: 'bg-cyan-500'   },
    { label: t.segTax,        value: entry.tax,               color: 'bg-pink-500'   },
    { label: 'Penalty',       value: entry.penalty,           color: 'bg-orange-500' },
    { label: 'Storage',       value: entry.storageFee,        color: 'bg-teal-500'   },
    { label: t.segOther,      value: entry.otherDeductions + entry.additionalPayment, color: 'bg-slate-500' },
  ].filter(s => s.value > 0)

  return (
    <div className="px-5 py-4 bg-[var(--bg-card2)] border-t border-[var(--border)] space-y-3">
      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">{t.deductionsTitle}</p>

      {/* Proportional bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {segments.map(seg => (
          <div
            key={seg.label}
            className={`${seg.color} opacity-80`}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${fmtShort(seg.value)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${seg.color} opacity-80`} />
            <span className="text-[var(--text-muted)] text-xs truncate">{seg.label}</span>
            <span className="text-[var(--text-dim)] text-xs font-medium ml-auto">{fmtShort(seg.value)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
        <span className="text-[var(--text-muted)] text-xs">{t.totalDeductions}</span>
        <span className="text-[var(--text-base)] text-sm font-bold">{fmt(total)}</span>
      </div>
    </div>
  )
}

const MP_TAB_VALUES = ['all', 'uzum', 'yandex_market', 'wildberries'] as const
type MpFilter = typeof MP_TAB_VALUES[number]

export default function PayoutsView({ entries }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mpFilter, setMpFilter] = useState<MpFilter>('all')
  const printRef = useRef<HTMLDivElement>(null)

  const mpTabs = [
    { value: 'all' as const,           label: t.tabAll },
    { value: 'uzum' as const,          label: t.tabUzum },
    { value: 'yandex_market' as const, label: t.tabYandex },
    { value: 'wildberries' as const,   label: t.tabWb },
  ]

  const filteredEntries = mpFilter === 'all' ? entries : entries.filter(e => e.marketplace === mpFilter)

  const paidEntries = filteredEntries.filter(e => e.status === 'paid' || e.status === 'estimated_paid')
  const totalPaid   = paidEntries.reduce((s, e) => s + e.netPayout, 0)
  const pending     = filteredEntries.filter(e => e.status !== 'paid' && e.status !== 'estimated_paid').reduce((s, e) => s + e.netPayout, 0)
  const avgPaid     = paidEntries.length > 0 ? Math.round(totalPaid / paidEntries.length) : 0

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const exportData = filteredEntries.map(e => ({
    [t.colPeriod]:              e.period,
    [t.colOrders]:              e.ordersCount,
    [`${t.colGross} (so'm)`]:   e.grossRevenue,
    [`${t.colCommission} (so'm)`]: e.commission,
    [`${t.colDelivery} (so'm)`]: e.delivery,
    [`${t.colReturns} (so'm)`]: e.returns,
    [`${t.colAd} (so'm)`]:      e.adSpend,
    [`${t.colTax} (so'm)`]:     e.tax,
    [`${t.colNet} (so'm)`]:     e.netPayout,
    [t.colStatus]: (e.status === 'paid' || e.status === 'estimated_paid') ? `${e.payoutEstimated ? '≈ ' : ''}${t.statusPaid}` : e.status === 'processing' ? t.statusProcessing : `${e.payoutEstimated ? '≈ ' : ''}${t.statusPending}`,
  }))

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Marketplace tabs + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
            {mpTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setMpFilter(tab.value); setExpandedId(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mpFilter === tab.value
                    ? 'text-[var(--c1)]'
                    : 'text-[var(--text-base)] hover:text-[var(--c1)]'
                }`}
                style={mpFilter === tab.value ? { background: 'var(--bg-base)', border: '1px solid var(--border)' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        <ExportButton data={exportData} filename="tolovu-hisoboti" targetRef={printRef} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiTotalPaid}</p>
          <p className="text-[var(--text-base)] text-xl font-bold">{fmtShort(totalPaid)}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{paidEntries.length} {t.periods}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiPending}</p>
          <p className="text-amber-400 text-xl font-bold">{fmtShort(pending)}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{filteredEntries.filter(e => e.status !== 'paid' && e.status !== 'estimated_paid').length} {t.periods}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiAvg}</p>
          <p className="text-[var(--text-base)] text-xl font-bold">{fmtShort(avgPaid)}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{t.perPeriod}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colPeriod}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colOrders}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colGross}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colCommission}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colDelivery}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colReturns}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colAd}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colTax}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    {t.colNet}
                    <span title={t.colNet}>
                      <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)] cursor-help" />
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colStatus}</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => {
                const period = formatPeriod(entry.period, locale)
                const topItem = entry.items[0]
                return (
                <Fragment key={entry.id}>
                  <tr
                    onClick={() => toggle(entry.id)}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-card2)] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[var(--text-base)] text-sm font-medium">{period.label}</p>
                        {entry.marketplace && <MpBadge mp={entry.marketplace as MarketplaceType} />}
                      </div>
                      <p className="text-[var(--text-muted)] text-xs">
                        {period.range}
                        {entry.payoutDate && ` · ${entry.payoutDate}`}
                      </p>
                      {topItem && (
                        <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate max-w-[280px]" title={topItem.productTitle}>
                          {topItem.productTitle}
                          {entry.items.length > 1 && ` +${entry.items.length - 1}`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-sm">{entry.ordersCount}</td>
                    <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-sm">{fmtShort(entry.grossRevenue)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.commission)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.delivery)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.returns)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.adSpend)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.tax)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-[var(--text-base)] font-bold text-sm">{fmtShort(entry.netPayout)}</span>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={entry.status} /></td>
                    <td className="px-3 py-3.5 text-[var(--text-muted)]">
                      {expandedId === entry.id
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="border-b border-[var(--border)]">
                      <td colSpan={11} className="p-0">
                        <ItemBreakdown items={entry.items} />
                        <DeductionBar entry={entry} />
                      </td>
                    </tr>
                  )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
