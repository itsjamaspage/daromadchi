'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, AlertTriangle, Bell, Package } from 'lucide-react'
import type { StockAlert } from '@/lib/db/alerts'
import type { AlertSettings } from '@/lib/db/alerts'
import ExportButton from '@/components/dashboard/ExportButton'
import MpBadge from '@/components/dashboard/MpBadge'
import TelegramConnect from '@/components/dashboard/TelegramConnect'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

interface Props {
  alerts: StockAlert[]
  settings: AlertSettings
}

// Same UX as ProductsTable's StockHint: opens on hover (desktop) and tap
// (mobile). Purple accent when per-listing stock differs from group
// physical total, grey otherwise.
function AlertStockHint({ alert }: { alert: StockAlert }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const total = alert.totalPhysical ?? alert.currentStock
  const perListing = alert.currentStock
  const differs = !!alert.isShared && total !== perListing

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help"
        style={{
          background: differs ? 'rgba(168,85,247,0.15)' : 'rgba(100,116,139,0.15)',
          color: differs ? '#a855f7' : 'var(--text-muted)',
          border: `1px solid ${differs ? 'rgba(168,85,247,0.35)' : 'rgba(100,116,139,0.3)'}`,
        }}
        aria-label={d.stockHintAria}
      >
        ?
      </button>
      {open && (
        <span
          className="absolute left-0 top-6 z-30 w-64 rounded-xl p-3 text-left text-xs leading-relaxed shadow-xl"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-base)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold mb-1.5" style={{ color: 'var(--text-base)' }}>
            {d.stockHintTitle}
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>{d.stockHintWarehouse}</span>
            <span className="font-bold tabular-nums" style={{ color: differs ? '#a855f7' : 'var(--text-base)' }}>{total}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span style={{ color: 'var(--text-muted)' }}>{d.stockHintMarketplace}</span>
            <span className="font-medium tabular-nums" style={{ color: 'var(--text-base)' }}>{perListing}</span>
          </div>
          <div className="mt-2 pt-2 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {alert.isShared ? d.stockHintShared : d.stockHintSingle}
          </div>
        </span>
      )}
    </span>
  )
}

export default function StockAlertsView({ alerts, settings: initialSettings }: Props) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Match the per-row classification: out-of-stock always counts as
  // critical, everything else follows the daysLeft thresholds.
  const critical = alerts.filter(a => a.currentStock <= 0 || a.daysLeft <= 3).length
  const warning  = alerts.filter(a => a.currentStock > 0 && a.daysLeft > 3 && a.daysLeft <= 7).length

  const exportData = alerts.map(a => ({
    [d.colProduct]:    a.productTitle,
    [d.colSku]:        a.sku,
    [d.colStock]:      a.currentStock,
    [d.colThreshold]:  a.threshold,
    [d.colDaysLeft]:   a.daysLeft,
    [d.colDailySales]: a.dailySales,
    [d.colStatus]: (a.currentStock <= 0 || a.daysLeft <= 3) ? d.statusCritical : a.daysLeft <= 7 ? d.statusWarning : d.statusWatch,
  }))

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/alerts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        // Reload the server-rendered alerts list with the new threshold.
        // Without this the top table keeps showing rows filtered by the
        // OLD threshold (e.g. saving 5 leaves the 15-threshold list on
        // screen), and every "Порог" cell keeps reading the stale number.
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  function daysLeftBadge(daysLeft: number, dailySales: number) {
    if (dailySales === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-500/15 text-[var(--text-muted)] border border-[var(--border)]">
          {d.noSales ?? 'Sotuv yo\'q'}
        </span>
      )
    }
    if (daysLeft <= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
          {daysLeft} {d.daysSuffix}
        </span>
      )
    }
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
          {daysLeft} {d.daysSuffix}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        {daysLeft} {d.daysSuffix}
      </span>
    )
  }

  return (
    <div className="space-y-4" ref={printRef}>
      {alerts.length > 0 && (
        <div className="flex justify-end">
          <ExportButton data={exportData} filename={d.alertsExportName} targetRef={printRef} />
        </div>
      )}
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{d.alertsTotal}</p>
          <p className="text-[var(--text-base)] text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{d.alertsCritical}</p>
          <p className="text-red-400 text-2xl font-bold">{critical}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{d.alertsWarning}</p>
          <p className="text-amber-400 text-2xl font-bold">{warning}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm flex-1">{d.stockStatus}</h2>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`p-2 rounded-xl transition-all ${
              showSettings
                ? 'bg-[var(--bg-card2)] text-[var(--c1)] border border-[var(--border)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-[var(--bg-card2)]'
            }`}
            title={d.alertsSettingsBtn}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-card2)] space-y-4">
            <h3 className="text-[var(--text-base)] text-sm font-semibold">{d.alertsSettings}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[var(--text-muted)] text-xs">{d.criticalThreshold}</label>
                <input
                  type="number"
                  min={1}
                  value={settings.stockThreshold}
                  onChange={e => setSettings(s => ({ ...s, stockThreshold: Number(e.target.value) }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] focus:outline-none focus:border-[var(--border2)] transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-[var(--c1)] hover:bg-[#6aabf0] disabled:opacity-60 text-[var(--text-base)] text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {saving ? d.saving : saved ? d.saved : d.save}
              </button>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-[var(--text-base)] font-medium">{d.allStocked}</p>
            <p className="text-[var(--text-muted)] text-sm">{d.allStockedDesc}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[d.colProduct, d.colSku, d.colStock, d.colThreshold, d.colDaysLeft, d.colDailySales, d.colStatus].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {alerts.map(alert => {
                  // A completely out-of-stock listing is ALWAYS critical
                  // regardless of recent sales — the seller was confused
                  // when a "0 шт · 0/день" row rendered as green
                  // "Наблюдение" while a "0 шт · 0.1/день" row on the
                  // same page rendered red "Критично". If you have 0
                  // stock, you cannot ship anything: that's a red row.
                  const outOfStock = alert.currentStock <= 0
                  const isCritical = outOfStock || alert.daysLeft <= 3
                  const isWarning  = !isCritical && alert.daysLeft <= 7
                  return (
                    <tr
                      key={alert.productId}
                      className="hover:bg-[var(--bg-card2)] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <div className="min-w-0">
                            <div className="text-[var(--text-base)] text-sm font-medium">{alert.productTitle}</div>
                            <div className="mt-0.5">
                              <MpBadge mp={alert.marketplace} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-sm font-mono">{alert.sku}</td>
                      <td className="px-5 py-3.5">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${
                            isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[var(--text-base)]'
                          }`}>
                            {alert.currentStock} {d.unitsSuffix}
                          </span>
                          <AlertStockHint alert={alert} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-sm">{alert.threshold} {d.unitsSuffix}</td>
                      <td className="px-5 py-3.5">{daysLeftBadge(alert.daysLeft, alert.dailySales)}</td>
                      <td className="px-5 py-3.5 text-[var(--text-dim)] text-sm">{alert.dailySales}{d.perDay}</td>
                      <td className="px-5 py-3.5">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                            <Bell className="w-3 h-3" /> {d.statusCritical}
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> {d.statusWarning}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-card2)] text-[var(--text-muted)] border border-[var(--border)]">
                            {d.statusWatch}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Telegram bot connection + notification preferences */}
      <TelegramConnect />
    </div>
  )
}
