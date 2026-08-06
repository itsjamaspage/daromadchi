'use client'

import { useMemo } from 'react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { AdSpendByMarketplace } from '@/lib/db/ads'

const MP_LABEL: Record<string, string> = {
  uzum: 'Uzum',
  yandex_market: 'Yandex Market',
  wildberries: 'Wildberries',
}

function fsFull(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

interface Props {
  rows: AdSpendByMarketplace[]
}

export default function AdSpendView({ rows }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].advertising

  const totals = useMemo(() => ({
    spend:       rows.reduce((s, r) => s + r.spend, 0),
    cash:        rows.reduce((s, r) => s + r.cash, 0),
    bonus:       rows.reduce((s, r) => s + r.bonus, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    clicks:      rows.reduce((s, r) => s + r.clicks, 0),
  }), [rows])

  if (rows.length === 0) {
    return (
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-2">
        <p className="text-[var(--text-base)] font-semibold text-lg">{t.noData}</p>
        <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto">{t.noDataDesc}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { label: t.kpiSpend,       value: fsFull(totals.spend), color: 'text-red-400' },
          { label: t.colCash,        value: fsFull(totals.cash),  color: 'text-[var(--text-base)]' },
          { label: t.colBonus,       value: fsFull(totals.bonus), color: 'text-emerald-400' },
          { label: t.kpiImpressions, value: totals.impressions.toLocaleString('uz-UZ'), color: 'text-[var(--text-base)]' },
          { label: t.kpiClicks,      value: totals.clicks.toLocaleString('uz-UZ'),      color: 'text-[var(--text-base)]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <p className="text-xs text-[var(--text-base)] mb-1">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Per-marketplace table */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[t.colMarketplace, t.colSpend, t.colCash, t.colBonus, t.colImpressions, t.colClicks].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-base)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map(r => (
                <tr key={r.marketplace} className="hover:bg-[var(--bg-card2)] transition-colors">
                  <td className="px-3 py-3 text-[var(--text-base)] text-xs font-medium">{MP_LABEL[r.marketplace] ?? r.marketplace}</td>
                  <td className="px-3 py-3 text-red-400 text-xs">{fsFull(r.spend)}</td>
                  <td className="px-3 py-3 text-[var(--text-base)] text-xs">{fsFull(r.cash)}</td>
                  <td className="px-3 py-3 text-emerald-400 text-xs">{r.bonus > 0 ? fsFull(r.bonus) : '—'}</td>
                  <td className="px-3 py-3 text-[var(--text-base)] text-xs">{r.impressions.toLocaleString('uz-UZ')}</td>
                  <td className="px-3 py-3 text-[var(--text-base)] text-xs">{r.clicks.toLocaleString('uz-UZ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[var(--text-muted)] text-xs">{t.bonusNote}</p>
    </div>
  )
}
