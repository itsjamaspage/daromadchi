'use client'

import { useState, useRef } from 'react'
import { Settings2, AlertTriangle, Bell, Package } from 'lucide-react'
import type { StockAlert } from '@/lib/db/alerts'
import type { AlertSettings } from '@/lib/db/alerts'
import ExportButton from '@/components/dashboard/ExportButton'
import TelegramConnect from '@/components/dashboard/TelegramConnect'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

interface Props {
  alerts: StockAlert[]
  settings: AlertSettings
}

export default function StockAlertsView({ alerts, settings: initialSettings }: Props) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const critical = alerts.filter(a => a.daysLeft <= 3).length
  const warning  = alerts.filter(a => a.daysLeft > 3 && a.daysLeft <= 7).length

  const exportData = alerts.map(a => ({
    [d.colProduct]:    a.productTitle,
    [d.colSku]:        a.sku,
    [d.colStock]:      a.currentStock,
    [d.colThreshold]:  a.threshold,
    [d.colDaysLeft]:   a.daysLeft,
    [d.colDailySales]: a.dailySales,
    [d.colStatus]: a.daysLeft <= 3 ? d.statusCritical : a.daysLeft <= 7 ? d.statusWarning : d.statusWatch,
  }))

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/alerts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function daysLeftBadge(daysLeft: number) {
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
        {daysLeft} {t.daysSuffix}
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
                ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20'
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
                  className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-[var(--text-base)] text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
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
                  const isCritical = alert.daysLeft <= 3
                  const isWarning  = alert.daysLeft <= 7
                  return (
                    <tr
                      key={alert.productId}
                      className="hover:bg-[var(--bg-card2)] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <span className="text-[var(--text-base)] text-sm font-medium">{alert.productTitle}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-sm font-mono">{alert.sku}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-bold ${
                          isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[var(--text-base)]'
                        }`}>
                          {alert.currentStock} {d.unitsSuffix}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-sm">{alert.threshold} {d.unitsSuffix}</td>
                      <td className="px-5 py-3.5">{daysLeftBadge(alert.daysLeft)}</td>
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
