'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, Boxes } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

type Key = 'inApp' | 'telegram'

// Two INDEPENDENT toggles for the cross-store stock-update notification.
// Each saves on its own; the in-app toggle works with or without Telegram
// linked (the Telegram toggle simply has no effect until a chat is connected).
export default function StockNotifyToggles() {
  const { lang } = useLang()
  const d = translations[lang].dashboard

  const [prefs, setPrefs] = useState<Record<Key, boolean>>({ inApp: true, telegram: true })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/alerts/stock-notify')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!alive || !data) return
        setPrefs({ inApp: data.inApp ?? true, telegram: data.telegram ?? true })
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  async function toggle(key: Key) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next) // optimistic
    try {
      await fetch('/api/alerts/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch {
      setPrefs(prefs) // revert on failure
    }
  }

  const rows: { key: Key; label: string; icon: React.ElementType }[] = [
    { key: 'inApp',    label: d.stockNotifInApp,    icon: Bell },
    { key: 'telegram', label: d.stockNotifTelegram, icon: Send },
  ]

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center">
          <Boxes className="w-4 h-4 text-[var(--c1)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.stockNotifTitle}</h2>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{d.stockNotifDesc}</p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            disabled={loading}
            onClick={() => toggle(key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-60 ${
              prefs[key]
                ? 'bg-[var(--bg-card2)] border-[var(--border)]'
                : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-[var(--border2)]'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${prefs[key] ? 'text-[var(--c1)]' : 'text-[var(--text-muted)]'}`} />
            <span className={`text-xs font-medium flex-1 ${prefs[key] ? 'text-[var(--text-base)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
            <span className={`w-9 h-5 rounded-full p-0.5 flex-shrink-0 transition-colors ${prefs[key] ? 'bg-[var(--c1)]' : 'bg-[var(--border2)]'}`}>
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-4' : ''}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
