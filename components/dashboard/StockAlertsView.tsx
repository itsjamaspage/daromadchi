'use client'

import { useState, useRef } from 'react'
import { Settings2, AlertTriangle, Bell, Package } from 'lucide-react'
import type { StockAlert } from '@/lib/db/alerts'
import type { AlertSettings } from '@/lib/db/alerts'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

interface Props {
  alerts: StockAlert[]
  settings: AlertSettings
}

export default function StockAlertsView({ alerts, settings: initialSettings }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].stockAlerts
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const critical = alerts.filter(a => a.daysLeft <= 3).length
  const warning  = alerts.filter(a => a.daysLeft > 3 && a.daysLeft <= 7).length

  const exportData = alerts.map(a => ({
    [t.colProduct]:   a.productTitle,
    'SKU':            a.sku,
    [`${t.colStock} (${t.units})`]:     a.currentStock,
    [`${t.colThreshold} (${t.units})`]: a.threshold,
    [t.colDaysLeft]:  a.daysLeft,
    [t.colDailyStock]: a.dailySales,
    [t.colStatus]:    a.daysLeft <= 3 ? t.statusCritical : a.daysLeft <= 7 ? t.statusWarning : t.statusWatching,
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
          {daysLeft} {t.daysSuffix}
        </span>
      )
    }
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
          {daysLeft} {t.daysSuffix}
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
          <ExportButton data={exportData} filename="zaxira-ogohlantirishlar" targetRef={printRef} />
        </div>
      )}
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiTotal}</p>
          <p className="text-[var(--text-base)] text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiCritical}</p>
          <p className="text-red-400 text-2xl font-bold">{critical}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiWarning}</p>
          <p className="text-amber-400 text-2xl font-bold">{warning}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm flex-1">{t.stockHeader}</h2>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`p-2 rounded-xl transition-all ${
              showSettings
                ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20'
                : 'text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-white/[0.05]'
            }`}
            title="Sozlamalar"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="px-5 py-4 border-b border-white/[0.05] bg-white/[0.015] space-y-4">
            <h3 className="text-[var(--text-base)] text-sm font-semibold">{t.settingsTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[var(--text-muted)] text-xs">{t.settingsThreshold}</label>
                <input
                  type="number"
                  min={1}
                  value={settings.stockThreshold}
                  onChange={e => setSettings(s => ({ ...s, stockThreshold: Number(e.target.value) }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[var(--text-muted)] text-xs">Telegram Bot Token</label>
                <input
                  type="password"
                  value={settings.telegramBotToken}
                  onChange={e => setSettings(s => ({ ...s, telegramBotToken: e.target.value }))}
                  placeholder="1234567890:AAF..."
                  className="w-full bg-[var(--bg-base)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[var(--text-muted)] text-xs">Telegram Chat ID</label>
                <input
                  type="text"
                  value={settings.telegramChatId}
                  onChange={e => setSettings(s => ({ ...s, telegramChatId: e.target.value }))}
                  placeholder="-1001234567890"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-[var(--text-base)] text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {saving ? t.savingBtn : saved ? t.savedBtn : t.saveBtn}
              </button>
              <p className="text-[var(--text-muted)] text-xs">{t.telegramHint}</p>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-[var(--text-base)] font-medium">{t.emptyTitle}</p>
            <p className="text-[var(--text-muted)] text-sm">{t.emptyDesc}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {[t.colProduct, 'SKU', t.colStock, t.colThreshold, t.colDaysLeft, t.colDailyStock, t.colStatus].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {alerts.map(alert => {
                  const isCritical = alert.daysLeft <= 3
                  const isWarning  = alert.daysLeft <= 7
                  return (
                    <tr
                      key={alert.productId}
                      className="hover:bg-white/[0.02] transition-colors"
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
                          {alert.currentStock} {t.units}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-sm">{alert.threshold} {t.units}</td>
                      <td className="px-5 py-3.5">{daysLeftBadge(alert.daysLeft)}</td>
                      <td className="px-5 py-3.5 text-[var(--text-dim)] text-sm">{alert.dailySales}{t.perDay}</td>
                      <td className="px-5 py-3.5">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                            <Bell className="w-3 h-3" /> {t.statusCritical}
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> {t.statusWarning}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/15 text-[var(--text-muted)] border border-slate-500/20">
                            {t.statusWatching}
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
    </div>
  )
}
