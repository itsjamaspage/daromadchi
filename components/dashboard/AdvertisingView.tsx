'use client'

import { useState, useMemo, useRef } from 'react'
import { ExternalLink, Info } from 'lucide-react'
import type { AdCampaign, AdType } from '@/lib/types'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

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
function statusLabel(s: AdCampaign['status'], t: { statusActive: string; statusPaused: string; statusEnded: string }) {
  return s === 'active' ? t.statusActive : s === 'paused' ? t.statusPaused : t.statusEnded
}

type MarketplaceTab = 'uzum' | 'wb' | 'ym'

interface Props {
  uzumCampaigns: AdCampaign[]
  wbCampaigns: AdCampaign[]
}

export default function AdvertisingView({ uzumCampaigns, wbCampaigns }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].advertising
  const [marketplace, setMarketplace] = useState<MarketplaceTab>('uzum')
  const [typeTab, setTypeTab] = useState<AdType | 'all'>('all')
  const printRef = useRef<HTMLDivElement>(null)

  const campaigns = marketplace === 'uzum' ? uzumCampaigns : marketplace === 'wb' ? wbCampaigns : []

  const filtered = useMemo(() =>
    typeTab === 'all' ? campaigns : campaigns.filter(c => c.type === typeTab),
    [campaigns, typeTab]
  )

  const totals = useMemo(() => {
    const spend       = filtered.reduce((s, c) => s + c.spend, 0)
    const impressions = filtered.reduce((s, c) => s + c.impressions, 0)
    const clicks      = filtered.reduce((s, c) => s + c.clicks, 0)
    const orders      = filtered.reduce((s, c) => s + c.orders, 0)
    const revenue     = filtered.reduce((s, c) => s + c.revenue, 0)
    const withRev     = filtered.filter(c => c.revenue > 0)
    const drr         = withRev.length ? filtered.reduce((s, c) => s + c.drr, 0) / withRev.length : 0
    return {
      spend, impressions, clicks, orders, revenue, drr,
      cpo:  orders > 0 ? spend / orders : 0,
      cr:   clicks > 0 ? (orders / clicks) * 100 : 0,
      roas: spend  > 0 ? revenue / spend : 0,
    }
  }, [filtered])

  const exportData = filtered.map(c => ({
    [t.colCampaign]:            c.name,
    [t.colType]:                c.type.toUpperCase(),
    [t.colStatus]:              statusLabel(c.status, t),
    'Mahsulot':                 c.productTitle,
    [`${t.colSpend} (so'm)`]:  Math.round(c.spend),
    [t.colImpressions]:        c.impressions,
    [t.colClicks]:             c.clicks,
    [`${t.colCtr} (%)`]:      c.ctr.toFixed(2),
    [t.colOrders]:             c.orders,
    [`${t.colRevenue} (so'm)`]: Math.round(c.revenue),
    [`${t.colDrr} (%)`]:      c.drr.toFixed(1),
    'CPO':  c.orders > 0 ? Math.round(c.spend / c.orders) : '—',
    'CR (%)': c.clicks > 0 ? ((c.orders / c.clicks) * 100).toFixed(2) : '—',
    'ROAS': c.spend  > 0 ? (c.revenue / c.spend).toFixed(2) : '—',
  }))

  const ymHint = {
    uz: { title: "Yandex Market reklama statistikasini API orqali taqdim etmaydi", desc: "Reklama kampaniyalari alohida OAuth talab qiladigan Yandex Direct orqali boshqariladi. Statistikani bevosita sotuvchi kabinetida ko'ring." },
    ru: { title: 'Яндекс.Маркет не предоставляет рекламную статистику через API', desc: 'Рекламные кампании управляются через Яндекс.Директ — отдельный сервис с отдельной авторизацией. Смотрите статистику напрямую в кабинете продавца.' },
    en: { title: 'Yandex Market does not share ad statistics via API', desc: 'Ad campaigns are managed through Yandex Direct, a separate service requiring its own OAuth. View your stats directly in the seller portal.' },
  }[lang]

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Marketplace tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {(['uzum', 'wb', 'ym'] as MarketplaceTab[]).map(mp => (
          <button key={mp} onClick={() => setMarketplace(mp)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              marketplace === mp
                ? 'border border-[rgba(131,192,249,0.35)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
            style={marketplace === mp ? { color: 'var(--c1)', background: 'rgba(131,192,249,0.15)' } : {}}>
            {mp === 'uzum' ? 'Uzum' : mp === 'wb' ? 'Wildberries' : 'Yandex Market'}
          </button>
        ))}
      </div>

      {/* YM: not available notice */}
      {marketplace === 'ym' && (
        <div className="bg-[var(--bg-card2)] border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Info className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[var(--text-base)] font-semibold text-sm mb-1">{ymHint.title}</p>
              <p className="text-[var(--text-muted)] text-xs leading-relaxed">{ymHint.desc}</p>
              <a href="https://partner.market.yandex.ru" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium">
                <ExternalLink className="w-3.5 h-3.5" /> {t.goYandex}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Uzum/WB: no data */}
      {marketplace !== 'ym' && campaigns.length === 0 && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
          <p className="text-[var(--text-base)] font-semibold text-lg">{t.noData}</p>
          <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto">{t.noDataDesc}</p>
          <div className="flex justify-center pt-2">
            <a href={marketplace === 'uzum' ? 'https://seller.uzum.uz' : 'https://seller.wildberries.ru'}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg">
              <ExternalLink className="w-4 h-4" />
              {marketplace === 'uzum' ? t.goUzum : t.goWb}
            </a>
          </div>
        </div>
      )}

      {/* Main content */}
      {marketplace !== 'ym' && campaigns.length > 0 && (
        <>
          {/* KPI row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: t.kpiSpend,       value: fsFull(totals.spend),   color: 'text-red-400' },
              { label: t.kpiImpressions, value: totals.impressions.toLocaleString('uz-UZ'), color: 'text-[var(--text-base)]' },
              { label: t.kpiClicks,      value: totals.clicks.toLocaleString('uz-UZ'),      color: 'text-[var(--text-base)]' },
              { label: t.kpiOrders,      value: String(totals.orders),   color: 'text-[var(--text-base)]' },
              { label: t.kpiRevenue,     value: fsFull(totals.revenue),  color: 'text-emerald-400' },
              { label: t.kpiDrr,         value: totals.drr > 0 ? `${totals.drr.toFixed(1)}%` : '—', color: drrColor(totals.drr) },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className={`text-sm font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* KPI row 2: CPO, CR, ROAS */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'CPO',
                value: totals.cpo > 0 ? fsFull(totals.cpo) : '—',
                color: 'text-orange-400',
                hint: lang === 'ru' ? 'Стоимость одного заказа' : lang === 'en' ? 'Cost per order' : 'Bitta buyurtma narxi',
              },
              {
                label: 'CR',
                value: totals.cr > 0 ? `${totals.cr.toFixed(1)}%` : '—',
                color: 'text-sky-400',
                hint: lang === 'ru' ? 'Конверсия из кликов в заказы' : lang === 'en' ? 'Click-to-order rate' : 'Kliklardan buyurtmaga',
              },
              {
                label: 'ROAS',
                value: totals.roas > 0 ? `${totals.roas.toFixed(1)}x` : '—',
                color: totals.roas >= 3 ? 'text-emerald-400' : totals.roas >= 1 ? 'text-amber-400' : 'text-red-400',
                hint: lang === 'ru' ? 'Возврат на рекламные расходы' : lang === 'en' ? 'Return on ad spend' : 'Reklama rentabelligi',
              },
            ].map(({ label, value, color, hint }) => (
              <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
                <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
                <p className={`text-sm font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">{hint}</p>
              </div>
            ))}
          </div>

          {/* Type tabs + export */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
              {([['all', t.tabAll], ['cpc', 'CPC'], ['cpo', 'CPO']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setTypeTab(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeTab === v
                      ? 'border border-[rgba(131,192,249,0.35)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
                  }`}
                  style={typeTab === v ? { color: 'var(--c1)', background: 'rgba(131,192,249,0.15)' } : {}}>
                  {label}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto">
              <ExportButton data={exportData} filename="reklama-hisoboti" targetRef={printRef} />
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {[t.colCampaign, t.colType, t.colStatus, t.colSpend, t.colImpressions, t.colClicks, t.colCtr, t.colOrders, t.colRevenue, t.colDrr, 'CPO', 'CR', 'ROAS'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map(c => {
                    const cpo  = c.orders > 0 ? c.spend / c.orders : null
                    const cr   = c.clicks > 0 ? (c.orders / c.clicks) * 100 : null
                    const roas = c.spend  > 0 ? c.revenue / c.spend : null
                    return (
                      <tr key={c.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                        <td className="px-3 py-3">
                          <p className="text-[var(--text-base)] text-xs font-medium max-w-[200px] truncate">{c.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] mt-0.5 truncate max-w-[200px]">{c.productTitle}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.type === 'cpc' ? 'bg-blue-500/10 text-blue-400' : ''}`}
                            style={c.type !== 'cpc' ? { background: 'rgba(131,192,249,0.12)', color: 'var(--c1)' } : {}}
                          >{c.type.toUpperCase()}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(c.status)}`} />
                            <span className="text-xs text-[var(--text-muted)]">{statusLabel(c.status, t)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-red-400 text-xs">{fs(c.spend)}</td>
                        <td className="px-3 py-3 text-[var(--text-muted)] text-xs">{c.impressions.toLocaleString('uz-UZ')}</td>
                        <td className="px-3 py-3 text-[var(--text-dim)] text-xs">{c.clicks.toLocaleString('uz-UZ')}</td>
                        <td className="px-3 py-3 text-[var(--text-dim)] text-xs">{c.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[var(--text-base)] text-xs font-semibold">{c.orders}</span>
                            {c.orders === 0 && c.spend > 0 && (
                              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title={t.legendNoSale} />
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
                            <span className="text-[var(--text-muted)] text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-orange-400 text-xs">{cpo !== null ? fs(cpo) : '—'}</td>
                        <td className="px-3 py-3 text-sky-400 text-xs">{cr !== null ? `${cr.toFixed(1)}%` : '—'}</td>
                        <td className="px-3 py-3 text-xs">
                          {roas !== null ? (
                            <span className={roas >= 3 ? 'text-emerald-400' : roas >= 1 ? 'text-amber-400' : 'text-red-400'}>
                              {roas.toFixed(1)}x
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />{t.legendNoSale}</span>
            <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" /><span className="text-emerald-500">DRR &lt; 10%</span></span>
            <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-amber-500/30 border border-amber-500/50" /><span className="text-amber-500">DRR 10–20%</span></span>
            <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-red-500/30 border border-red-500/50" /><span className="text-red-500">DRR &gt; 20%</span></span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">ROAS ≥ 3x</span>
              = {lang === 'ru' ? 'отличная отдача' : lang === 'en' ? 'great return' : 'yaxshi qaytish'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
