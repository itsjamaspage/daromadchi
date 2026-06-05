'use client'

import { useState, useRef } from 'react'
import { Settings2, AlertTriangle, Bell, Package } from 'lucide-react'
import type { StockAlert } from '@/lib/db/alerts'
import type { AlertSettings } from '@/lib/db/alerts'
import ExportButton from '@/components/dashboard/ExportButton'
<<<<<<< HEAD
import TelegramConnect from '@/components/dashboard/TelegramConnect'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
=======
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
>>>>>>> origin/claude/friendly-rubin-IkT6S

interface Props {
  alerts: StockAlert[]
  settings: AlertSettings
}

export default function StockAlertsView({ alerts, settings: initialSettings }: Props) {
  const { lang } = useLang()
<<<<<<< HEAD
  const d = translations[lang].dashboard
=======
  const t = dashT[lang].stockAlerts
>>>>>>> origin/claude/friendly-rubin-IkT6S
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const critical = alerts.filter(a => a.daysLeft <= 3).length
  const warning  = alerts.filter(a => a.daysLeft > 3 && a.daysLeft <= 7).length

  const exportData = alerts.map(a => ({
<<<<<<< HEAD
    [d.colProduct]:    a.productTitle,
    [d.colSku]:        a.sku,
    [d.colStock]:      a.currentStock,
    [d.colThreshold]:  a.threshold,
    [d.colDaysLeft]:   a.daysLeft,
    [d.colDailySales]: a.dailySales,
    [d.colStatus]: a.daysLeft <= 3 ? d.statusCritical : a.daysLeft <= 7 ? d.statusWarning : d.statusWatch,
=======
    [t.colProduct]:   a.productTitle,
    'SKU':            a.sku,
    [`${t.colStock} (${t.units})`]:     a.currentStock,
    [`${t.colThreshold} (${t.units})`]: a.threshold,
    [t.colDaysLeft]:  a.daysLeft,
    [t.colDailyStock]: a.dailySales,
    [t.colStatus]:    a.daysLeft <= 3 ? t.statusCritical : a.daysLeft <= 7 ? t.statusWarning : t.statusWatching,
>>>>>>> origin/claude/friendly-rubin-IkT6S
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
<<<<<<< HEAD
          {daysLeft} {d.daysSuffix}
=======
          {daysLeft} {t.daysSuffix}
>>>>>>> origin/claude/friendly-rubin-IkT6S
        </span>
      )
    }
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
<<<<<<< HEAD
          {daysLeft} {d.daysSuffix}
=======
          {daysLeft} {t.daysSuffix}
>>>>>>> origin/claude/friendly-rubin-IkT6S
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
<<<<<<< HEAD
          <p className="text-[var(--text-muted)] text-xs mb-1">{d.alertsTotal}</p>
          <p className="text-[var(--text-base)] text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{d.alertsCritical}</p>
          <p className="text-red-400 text-2xl font-bold">{critical}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{d.alertsWarning}</p>
=======
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiTotal}</p>
          <p className="text-[var(--text-base)] text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiCritical}</p>
          <p className="text-red-400 text-2xl font-bold">{critical}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs mb-1">{t.kpiWarning}</p>
>>>>>>> origin/claude/friendly-rubin-IkT6S
          <p className="text-amber-400 text-2xl font-bold">{warning}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
<<<<<<< HEAD
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm flex-1">{d.stockStatus}</h2>
=======
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm flex-1">{t.stockHeader}</h2>
>>>>>>> origin/claude/friendly-rubin-IkT6S
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`p-2 rounded-xl transition-all ${
              showSettings
                ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20'
<<<<<<< HEAD
                : 'text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-[var(--bg-card2)]'
=======
                : 'text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-white/[0.05]'
>>>>>>> origin/claude/friendly-rubin-IkT6S
            }`}
            title={d.alertsSettingsBtn}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
<<<<<<< HEAD
          <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-card2)] space-y-4">
            <h3 className="text-[var(--text-base)] text-sm font-semibold">{d.alertsSettings}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[var(--text-muted)] text-xs">{d.criticalThreshold}</label>
=======
          <div className="px-5 py-4 border-b border-white/[0.05] bg-white/[0.015] space-y-4">
            <h3 className="text-[var(--text-base)] text-sm font-semibold">{t.settingsTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[var(--text-muted)] text-xs">{t.settingsThreshold}</label>
>>>>>>> origin/claude/friendly-rubin-IkT6S
                <input
                  type="number"
                  min={1}
                  value={settings.stockThreshold}
                  onChange={e => setSettings(s => ({ ...s, stockThreshold: Number(e.target.value) }))}
<<<<<<< HEAD
                  className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50 transition-colors"
=======
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
>>>>>>> origin/claude/friendly-rubin-IkT6S
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-[var(--text-base)] text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
<<<<<<< HEAD
                {saving ? d.saving : saved ? d.saved : d.save}
              </button>
=======
                {saving ? t.savingBtn : saved ? t.savedBtn : t.saveBtn}
              </button>
              <p className="text-[var(--text-muted)] text-xs">{t.telegramHint}</p>
>>>>>>> origin/claude/friendly-rubin-IkT6S
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
<<<<<<< HEAD
            <p className="text-[var(--text-base)] font-medium">{d.allStocked}</p>
            <p className="text-[var(--text-muted)] text-sm">{d.allStockedDesc}</p>
=======
            <p className="text-[var(--text-base)] font-medium">{t.emptyTitle}</p>
            <p className="text-[var(--text-muted)] text-sm">{t.emptyDesc}</p>
>>>>>>> origin/claude/friendly-rubin-IkT6S
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
<<<<<<< HEAD
                <tr className="border-b border-[var(--border)]">
                  {[d.colProduct, d.colSku, d.colStock, d.colThreshold, d.colDaysLeft, d.colDailySales, d.colStatus].map(h => (
=======
                <tr className="border-b border-white/[0.04]">
                  {[t.colProduct, 'SKU', t.colStock, t.colThreshold, t.colDaysLeft, t.colDailyStock, t.colStatus].map(h => (
>>>>>>> origin/claude/friendly-rubin-IkT6S
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
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/claude/friendly-rubin-IkT6S
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
