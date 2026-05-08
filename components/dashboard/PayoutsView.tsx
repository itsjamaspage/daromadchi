'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import type { PayoutEntry } from '@/lib/db/payouts'
import ExportButton from '@/components/dashboard/ExportButton'

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
  if (status === 'paid') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        To&apos;langan
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        Jarayonda
      </span>
    )
  }
  return (
    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/20">
      Kutilmoqda
    </span>
  )
}

function DeductionBar({ entry }: { entry: PayoutEntry }) {
  const total = entry.commission + entry.delivery + entry.returns + entry.adSpend + entry.acquiring + entry.tax + entry.otherDeductions
  if (total === 0) return null

  const segments = [
    { label: 'Komissiya',    value: entry.commission,      color: 'bg-violet-500' },
    { label: 'Yetkazish',    value: entry.delivery,        color: 'bg-blue-500'   },
    { label: 'Qaytarishlar', value: entry.returns,         color: 'bg-red-500'    },
    { label: 'Reklama',      value: entry.adSpend,         color: 'bg-amber-500'  },
    { label: 'Ekvayring',    value: entry.acquiring,       color: 'bg-cyan-500'   },
    { label: 'Soliq',        value: entry.tax,             color: 'bg-pink-500'   },
    { label: 'Boshqa',       value: entry.otherDeductions, color: 'bg-slate-500'  },
  ].filter(s => s.value > 0)

  return (
    <div className="px-5 py-4 bg-white/[0.015] border-t border-white/[0.04] space-y-3">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Chegirmalar tafsiloti</p>

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
            <span className="text-slate-400 text-xs truncate">{seg.label}</span>
            <span className="text-slate-300 text-xs font-medium ml-auto">{fmtShort(seg.value)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
        <span className="text-slate-400 text-xs">Jami chegirmalar</span>
        <span className="text-white text-sm font-bold">{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function PayoutsView({ entries }: Props) {
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
    'Davr':            e.period,
    'Buyurtmalar':     e.ordersCount,
    "Brutto (so'm)":   e.grossRevenue,
    "Komissiya (so'm)": e.commission,
    "Yetkazish (so'm)": e.delivery,
    "Qaytarish (so'm)": e.returns,
    "Reklama (so'm)":  e.adSpend,
    "Soliq (so'm)":    e.tax,
    "Sof to'lov (so'm)": e.netPayout,
    'Holat': e.status === 'paid' ? "To'langan" : e.status === 'processing' ? 'Jarayonda' : 'Kutilmoqda',
  }))

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Export button */}
      <div className="flex justify-end">
        <ExportButton data={exportData} filename="tolovu-hisoboti" targetRef={printRef} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">Jami to&apos;langan</p>
          <p className="text-white text-xl font-bold">{fmtShort(totalPaid)}</p>
          <p className="text-slate-500 text-xs mt-0.5">{paidEntries.length} ta davr</p>
        </div>
        <div className="bg-[#13131f] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">Kutilayotgan</p>
          <p className="text-amber-400 text-xl font-bold">{fmtShort(pending)}</p>
          <p className="text-slate-500 text-xs mt-0.5">{entries.filter(e => e.status !== 'paid').length} ta davr</p>
        </div>
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl px-4 py-3">
          <p className="text-slate-400 text-xs mb-1">O&apos;rtacha to&apos;lov</p>
          <p className="text-white text-xl font-bold">{fmtShort(avgPaid)}</p>
          <p className="text-slate-500 text-xs mt-0.5">har bir davr</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Davr</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Buyurtmalar</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Brutto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Komissiya</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Yetkazish</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qaytarish</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Reklama</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Soliq</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    Sof to&apos;lov
                    <span title="Nima uchun bu miqdor? Brutto daromaddan barcha chegirmalar: komissiya, yetkazish, qaytarishlar, reklama xarajatlari, ekvayring va soliq ayiriladi.">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-600 cursor-help" />
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Holat</th>
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
                      <p className="text-white text-sm font-medium">{entry.period}</p>
                      {entry.payoutDate && (
                        <p className="text-slate-500 text-xs">{entry.payoutDate}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-300 text-sm">{entry.ordersCount}</td>
                    <td className="px-4 py-3.5 text-right text-slate-300 text-sm">{fmtShort(entry.grossRevenue)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.commission)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.delivery)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.returns)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.adSpend)}</td>
                    <td className="px-4 py-3.5 text-right text-red-400 text-sm">-{fmtShort(entry.tax)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-white font-bold text-sm">{fmtShort(entry.netPayout)}</span>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={entry.status} /></td>
                    <td className="px-3 py-3.5 text-slate-500">
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
