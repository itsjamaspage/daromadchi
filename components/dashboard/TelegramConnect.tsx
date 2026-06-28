/* eslint-disable react-hooks/set-state-in-effect */
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
    // Open the window synchronously before any await so browsers don't block the popup
    const win = window.open('', '_blank')
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const json = await res.json()
      if (json.url && win) {
        win.location.href = json.url
        // Poll for linked status for ~2 minutes
        const started = Date.now()
        const timer = setInterval(async () => {
          const s = await fetch('/api/telegram/status').then(r => r.json()).catch(() => null)
          if (s?.linked || Date.now() - started > 120_000) {
            clearInterval(timer)
            if (s?.linked) { setLinked(true); setUsername(s.username ?? null); if (s.prefs) setPrefs(s.prefs) }
            setLinking(false)
          }
        }, 3000)
      } else {
        win?.close()
        setLinking(false)
      }
    } catch {
      win?.close()
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

  const notifTypes = [
    { key: 'lowStock'     as const, label: d.tgNotifLowStock,     icon: Package },
    { key: 'dailySummary' as const, label: d.tgNotifDailySummary, icon: FileText },
    { key: 'newOrders'    as const, label: d.tgNotifNewOrders,    icon: ShoppingCart },
    { key: 'weeklyReport' as const, label: d.tgNotifWeeklyReport, icon: FileText },
  ]

  if (loading) {
    // Skeleton placeholder — same footprint as the real card so it doesn't pop in late
    return (
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden animate-pulse">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-input)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-[var(--bg-input)]" />
            <div className="h-2.5 w-48 rounded bg-[var(--bg-input)]" />
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="h-10 w-44 rounded-xl bg-[var(--bg-input)]" />
          <div className="h-2.5 w-64 rounded bg-[var(--bg-input)]" />
        </div>
      </div>
    )
  }

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
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-800">
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
                <Bell className="w-4 h-4 text-[#83c0f9]" /> {d.tgNotifTypes}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {notifTypes.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      prefs[key]
                        ? 'bg-[rgba(131,192,249,0.12)] border-[rgba(131,192,249,0.4)]'
                        : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-[var(--border2)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${prefs[key] ? 'text-[#83c0f9]' : 'text-[var(--text-muted)]'}`} />
                    <span className={`text-xs font-medium flex-1 ${prefs[key] ? 'text-[var(--text-base)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
                    <span className={`w-9 h-5 rounded-full p-0.5 flex-shrink-0 transition-colors ${prefs[key] ? 'bg-[#83c0f9]' : 'bg-[var(--border2)]'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery schedule — fixed daily at 10:00 for all users */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <p className="text-[var(--text-base)] text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#83c0f9]" /> {d.tgScheduleLabel}
              </p>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-base)]">
                  <Clock className="w-4 h-4 text-[#83c0f9]" /> {d.tgScheduleFixed}
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-xs">{d.tgScheduleFixedHint}</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={savePrefs}
                disabled={saving}
                className="bg-[#83c0f9] hover:bg-[#6aabf0] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
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
