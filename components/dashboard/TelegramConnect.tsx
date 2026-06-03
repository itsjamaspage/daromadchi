'use client'

import { useEffect, useState } from 'react'
import { Send, Check, Loader2, ExternalLink, Bell, Package, FileText, ShoppingCart, Clock } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

interface NotifPrefs {
  lowStock: boolean
  dailySummary: boolean
  newOrders: boolean
  weeklyReport: boolean
  sendTime: string
  sendDays: number[]
}

const DEFAULT_PREFS: NotifPrefs = {
  lowStock: true, dailySummary: true, newOrders: false, weeklyReport: false,
  sendTime: '09:00', sendDays: [1, 2, 3, 4, 5, 6, 0],
}

export default function TelegramConnect() {
  const { lang } = useLang()
  const d = translations[lang].dashboard

  const [loading, setLoading]       = useState(true)
  const [configured, setConfigured] = useState(true)
  const [linked, setLinked]         = useState(false)
  const [username, setUsername]     = useState<string | null>(null)
  const [linking, setLinking]       = useState(false)
  const [prefs, setPrefs]           = useState<NotifPrefs>(DEFAULT_PREFS)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  async function refresh() {
    try {
      const res = await fetch('/api/telegram/status')
      const json = await res.json()
      setConfigured(json.configured ?? false)
      setLinked(json.linked ?? false)
      setUsername(json.username ?? null)
      if (json.prefs) setPrefs(json.prefs)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function connect() {
    setLinking(true)
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const json = await res.json()
      if (json.url) {
        window.open(json.url, '_blank')
        // Poll for linked status for ~2 minutes
        const started = Date.now()
        const timer = setInterval(async () => {
          const s = await fetch('/api/telegram/status').then(r => r.json()).catch(() => null)
          if (s?.linked || Date.now() - started > 120_000) {
            clearInterval(timer)
            if (s?.linked) { setLinked(true); setUsername(s.username ?? null) }
            setLinking(false)
          }
        }, 3000)
      } else {
        setLinking(false)
      }
    } catch {
      setLinking(false)
    }
  }

  async function disconnect() {
    await fetch('/api/telegram/disconnect', { method: 'POST' })
    setLinked(false)
    setUsername(null)
  }

  async function savePrefs() {
    setSaving(true)
    try {
      await fetch('/api/telegram/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function toggleDay(day: number) {
    setPrefs(p => ({
      ...p,
      sendDays: p.sendDays.includes(day)
        ? p.sendDays.filter(x => x !== day)
        : [...p.sendDays, day].sort(),
    }))
  }

  const notifTypes = [
    { key: 'lowStock'     as const, label: d.tgNotifLowStock,     icon: Package },
    { key: 'dailySummary' as const, label: d.tgNotifDailySummary, icon: FileText },
    { key: 'newOrders'    as const, label: d.tgNotifNewOrders,    icon: ShoppingCart },
    { key: 'weeklyReport' as const, label: d.tgNotifWeeklyReport, icon: FileText },
  ]
  const dayLabels = [d.daySun, d.dayMon, d.dayTue, d.dayWed, d.dayThu, d.dayFri, d.daySat]
  const dayOrder  = [1, 2, 3, 4, 5, 6, 0]

  if (loading) return null

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
          <Send className="w-4 h-4 text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.tgTitle}</h2>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{d.tgDesc}</p>
        </div>
        {linked && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Check className="w-3 h-3" /> {d.tgConnected}{username ? ` · @${username}` : ''}
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {!configured ? (
          <p className="text-[var(--text-muted)] text-sm">{d.tgNotConfigured}</p>
        ) : !linked ? (
          <div className="space-y-3">
            <button
              onClick={connect}
              disabled={linking}
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {linking ? d.tgConnecting : d.tgConnect}
              {!linking && <ExternalLink className="w-3.5 h-3.5" />}
            </button>
            <p className="text-[var(--text-muted)] text-xs">{d.tgLinkHint}</p>
          </div>
        ) : (
          <>
            {/* Notification types */}
            <div className="space-y-2">
              <p className="text-[var(--text-base)] text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-violet-400" /> {d.tgNotifTypes}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {notifTypes.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      prefs[key]
                        ? 'bg-violet-600/15 border-violet-500/40'
                        : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-[var(--border2)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${prefs[key] ? 'text-violet-400' : 'text-[var(--text-muted)]'}`} />
                    <span className={`text-xs font-medium flex-1 ${prefs[key] ? 'text-[var(--text-base)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
                    <span className={`w-9 h-5 rounded-full p-0.5 flex-shrink-0 transition-colors ${prefs[key] ? 'bg-violet-500' : 'bg-[var(--border2)]'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-[var(--text-base)] text-sm font-semibold flex items-center gap-2 sm:w-40">
                  <Clock className="w-4 h-4 text-violet-400" /> {d.tgScheduleTime}
                </label>
                <input
                  type="time"
                  value={prefs.sendTime}
                  onChange={e => setPrefs(p => ({ ...p, sendTime: e.target.value }))}
                  className="bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <p className="text-[var(--text-muted)] text-xs">{d.tgScheduleDays}</p>
                <div className="flex flex-wrap gap-2">
                  {dayOrder.map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-11 h-9 rounded-xl text-xs font-semibold border transition-all ${
                        prefs.sendDays.includes(day)
                          ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                          : 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border2)]'
                      }`}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={savePrefs}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {saving ? d.saving : saved ? d.saved : d.tgSavePrefs}
              </button>
              <button
                onClick={disconnect}
                className="text-[var(--text-muted)] hover:text-red-400 text-xs font-medium transition-colors"
              >
                {d.tgDisconnect}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
