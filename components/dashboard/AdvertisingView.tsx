'use client'

import { useState, useMemo } from 'react'
import { Download, TrendingUp, TrendingDown, CircleDot } from 'lucide-react'
import type { AdCampaign, AdType } from '@/lib/types'

function fs(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' mln'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' ming'
  return String(n)
}
function fsFull(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

function drrColor(drr: number) {
  return drr < 10 ? 'text-emerald-400' : drr < 20 ? 'text-amber-400' : 'text-red-400'
}
function drrBg(drr: number) {
  return drr < 10 ? 'bg-emerald-500/10 text-emerald-400' : drr < 20 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
}
function statusDot(s: AdCampaign['status']) {
  return s === 'active' ? 'bg-emerald-400' : s === 'paused' ? 'bg-amber-400' : 'bg-slate-500'
}
function statusLabel(s: AdCampaign['status']) {
  return s === 'active' ? 'Faol' : s === 'paused' ? 'To\'xtatilgan' : 'Yakunlangan'
}

interface Props { campaigns: AdCampaign[] }

export default function AdvertisingView({ campaigns }: Props) {
  const [tab, setTab] = useState<AdType | 'all'>('all')

  const filtered = useMemo(() =>
    tab === 'all' ? campaigns : campaigns.filter(c => c.type === tab),
    [campaigns, tab]
  )

  const totals = useMemo(() => ({
    spend:       filtered.reduce((s, c) => s + c.spend, 0),
    impressions: filtered.reduce((s, c) => s + c.impressions, 0),
    clicks:      filtered.reduce((s, c) => s + c.clicks, 0),
    orders:      filtered.reduce((s, c) => s + c.orders, 0),
    revenue:     filtered.reduce((s, c) => s + c.revenue, 0),
    drr: filtered.length
      ? filtered.reduce((s, c) => s + c.drr, 0) / filtered.filter(c => c.revenue > 0).length
      : 0,
  }), [filtered])

  function exportExcel() {
    const header = ['Kampaniya', 'Tur', 'Holat', 'Mahsulot', 'Sarflar', 'Korsatuvlar', 'Kliklar', 'CTR', 'Buyurtmalar', 'Daromad', 'DRR'].join('\t')
    const rows = filtered.map(c =>
      [c.name, c.type.toUpperCase(), statusLabel(c.status), c.productTitle,
       Math.round(c.spend), c.impressions, c.clicks, c.ctr.toFixed(2) + '%',
       c.orders, Math.round(c.revenue), c.drr.toFixed(1) + '%'].join('\t')
    )
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'reklama.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Jami sarflar',    value: fsFull(totals.spend),            sub: undefined,             color: 'text-red-400'     },
          { label: 'Ko\'rsatuvlar',   value: totals.impressions.toLocaleString('uz-UZ'), sub: undefined,  color: 'text-white'       },
          { label: 'Kliklar',         value: totals.clicks.toLocaleString('uz-UZ'),      sub: undefined,  color: 'text-white'       },
          { label: 'Buyurtmalar',     value: String(totals.orders),            sub: undefined,             color: 'text-white'       },
          { label: 'Daromad',         value: fsFull(totals.revenue),           sub: undefined,             color: 'text-emerald-400' },
          { label: 'O\'rtacha DRR',   value: totals.drr > 0 ? `${totals.drr.toFixed(1)}%` : '—', sub: undefined, color: drrColor(totals.drr) },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#13131f] border border-white/[0.06] rounded-xl w-fit">
          {([['all','Hammasi'],['cpc','CPC'],['cpo','CPO']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === v ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#13131f] hover:bg-white/[0.04] text-slate-400 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.06] transition-all sm:ml-auto w-fit">
          <Download className="w-3.5 h-3.5" /> Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Kampaniya','Tur','Holat','Sarflar','Ko\'rs.','Kliklar','CTR','Buyurtma','Daromad','DRR'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3">
                    <p className="text-white text-xs font-medium max-w-[200px] truncate">{c.name}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 truncate max-w-[200px]">{c.productTitle}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      c.type === 'cpc' ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400'
                    }`}>{c.type.toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(c.status)}`} />
                      <span className="text-xs text-slate-400">{statusLabel(c.status)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-red-400 text-xs">{fs(c.spend)}</td>
                  <td className="px-3 py-3 text-slate-400 text-xs">{c.impressions.toLocaleString('uz-UZ')}</td>
                  <td className="px-3 py-3 text-slate-300 text-xs">{c.clicks.toLocaleString('uz-UZ')}</td>
                  <td className="px-3 py-3 text-slate-300 text-xs">{c.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-white text-xs font-semibold">{c.orders}</span>
                      {c.orders === 0 && c.spend > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Sarflar bor, sotuv yo'q" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-emerald-400 text-xs">{c.revenue > 0 ? fs(c.revenue) : '—'}</td>
                  <td className="px-3 py-3">
                    {c.revenue > 0 ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${drrBg(c.drr)}`}>
                        {c.drr.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Sarflar bor, sotuv yo&apos;q</span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-emerald-500/10 border border-emerald-500/20" /><span className="text-emerald-400">DRR &lt; 10%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-amber-500/10 border border-amber-500/20" /><span className="text-amber-400">DRR 10–20%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-red-500/10 border border-red-500/20" /><span className="text-red-400">DRR &gt; 20%</span></span>
      </div>
    </div>
  )
}
