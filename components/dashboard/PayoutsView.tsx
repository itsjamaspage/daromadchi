'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import type { PayoutEntry } from '@/lib/db/payouts'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

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
  if (status === 'processing') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        {t.statusProcessing}
      </span>
    )
  }
  return (
    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/15 text-[var(--text-muted)] border border-slate-500/20">
      {t.statusPending}
    </span>
  )
}

function DeductionBar({ entry }: { entry: PayoutEntry }) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const total = entry.commission + entry.delivery + entry.returns + entry.adSpend + entry.acquiring + entry.tax + entry.otherDeductions
  if (total === 0) return null

  const segments = [
    { label: t.segCommission, value: entry.commission,      color: 'bg-violet-500' },
    { label: t.segDelivery,   value: entry.delivery,        color: 'bg-blue-500'   },
    { label: t.segReturns,    value: entry.returns,         color: 'bg-red-500'    },
    { label: t.segAd,         value: entry.adSpend,         color: 'bg-amber-500'  },
    { label: t.segAcquiring,  value: entry.acquiring,       color: 'bg-cyan-500'   },
    { label: t.segTax,        value: entry.tax,             color: 'bg-pink-500'   },
    { label: t.segOther,      value: entry.otherDeductions, color: 'bg-slate-500'  },
  ].filter(s => s.value > 0)

  return (
    <div className="px-5 py-4 bg-white/[0.015] border-t border-white/[0.04] space-y-3">
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

      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
        <span className="text-[var(--text-muted)] text-xs">{t.totalDeductions}</span>
        <span className="text-[var(--text-base)] text-sm font-bold">{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function PayoutsView({ entries }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].payouts
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const paidEntries = entries.filter(e => e.status === 'paid')
  const totalPaid   = paidEntries.reduce((s, e) => s + e.netPayout, 0)
  const pending     = entries.filter(e => e.status !== 'paid').reduce((s, e) => s + e.netPayout, 0)
  const avgPaid     = paidEntries.length > 0 ? Math.round(totalPaid / paidEntries.length) : 0

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const exportData = entries.map(e => ({
    [t.colPeriod]:              e.period,
    [t.colOrders]:              e.ordersCount,
    [`${t.colGross} (so'm)`]:   e.grossRevenue,
    [`${t.colCommission} (so'm)`]: e.commission,
    [`${t.colDelivery} (so'm)`]: e.delivery,
    [`${t.colReturns} (so'm)`]: e.returns,
    [`${t.colAd} (so'm)`]:      e.adSpend,
    [`${t.colTax} (so'm)`]:     e.tax,
    [`${t.colNet} (so'm)`]:     e.netPayout,
    [t.colStatus]: e.status === 'paid' ? t.statusPaid : e.status === 'processing' ? t.statusProcessing : t.statusPending,
  }))

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Export button */}
      <div className="flex justify-end">
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
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{entries.filter(e => e.status !== 'paid').length} {t.periods}</p>
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
              <tr className="border-b border-white/[0.05]">
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
                    <span>
                      <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)] cursor-help" />
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t.colStatus}</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => toggle(entry.id)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[var(--text-base)] text-sm font-medium">{entry.period}</p>
                      {entry.payoutDate && (
                        <p className="text-[var(--text-muted)] text-xs">{entry.payoutDate}</p>
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
                    <tr key={`${entry.id}-detail`} className="border-b border-white/[0.03]">
                      <td colSpan={11} className="p-0">
                        <DeductionBar entry={entry} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
