'use client'

import { useState } from 'react'
import { Bell, MessageCircle, Save, CheckCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

// ── Toggle component ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-violet-600' : 'bg-white/[0.12]'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

type NotifSettings = {
  lowStock:     { enabled: boolean; days: number }
  adOverspend:  { enabled: boolean; drrThreshold: number }
  salesDrop:    { enabled: boolean; pctThreshold: number }
  newOrders:    { enabled: boolean }
  dailySummary: { enabled: boolean; time: 'morning' | 'evening' }
}

// ── Page ───────────────────────────────────────────────────────────────────────

const TELEGRAM_CONNECTED = false  // mock

export default function NotificationsPage() {
  const [saved, setSaved]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<NotifSettings>({
    lowStock:     { enabled: true,  days: 7 },
    adOverspend:  { enabled: true,  drrThreshold: 30 },
    salesDrop:    { enabled: false, pctThreshold: 20 },
    newOrders:    { enabled: true  },
    dailySummary: { enabled: true,  time: 'morning' },
  })

  function update<K extends keyof NotifSettings>(key: K, patch: Partial<NotifSettings[K]>) {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
    setSaved(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
    }, 600)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bildirishnomalar</h1>
        <p className="text-slate-400 text-sm mt-1">
          Muhim hodisalar haqida Telegram orqali xabar oling
        </p>
      </div>

      {/* Telegram connection card */}
      <Section title="Telegram ulanish" icon={MessageCircle}>
        <div className="p-5 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            TELEGRAM_CONNECTED
              ? 'bg-emerald-500/15 border border-emerald-500/25'
              : 'bg-slate-500/10 border border-slate-500/20'
          }`}>
            <MessageCircle className={`w-5 h-5 ${TELEGRAM_CONNECTED ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">
              {TELEGRAM_CONNECTED ? 'Telegram ulangan' : 'Telegram ulanmagan'}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {TELEGRAM_CONNECTED
                ? '@daromadchi_bot orqali xabar olasiz'
                : 'Bildirishnomalar olish uchun Telegram botini ulang'}
            </p>
          </div>
          {TELEGRAM_CONNECTED ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              Faol
            </span>
          ) : (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              Ulash <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </Section>

      {/* Notification preferences form */}
      <form onSubmit={handleSave}>
        <Section title="Bildirishnoma turlari" icon={Bell}>
          <div className="divide-y divide-white/[0.03]">

            {/* Low stock */}
            <div className="px-5 py-4 flex items-start gap-4">
              <Toggle
                checked={settings.lowStock.enabled}
                onChange={v => update('lowStock', { enabled: v })}
              />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Qoldiq tugamoqda</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Mahsulot zahirasi belgilangan kun sonidan kam bo'lganda xabar berish
                </p>
                {settings.lowStock.enabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-slate-400">Chegara (kun):</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.lowStock.days}
                      onChange={e => update('lowStock', { days: Number(e.target.value) })}
                      className="w-20 bg-[#1c1c2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-violet-500/60 transition-all"
                    />
                    <span className="text-xs text-slate-500">kundan kam</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ad overspend */}
            <div className="px-5 py-4 flex items-start gap-4">
              <Toggle
                checked={settings.adOverspend.enabled}
                onChange={v => update('adOverspend', { enabled: v })}
              />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Reklama ko'p sarf qilmoqda</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  DRR belgilangan chegaradan oshganda ogohlantirish yuborish
                </p>
                {settings.adOverspend.enabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-slate-400">DRR chegara:</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={settings.adOverspend.drrThreshold}
                      onChange={e => update('adOverspend', { drrThreshold: Number(e.target.value) })}
                      className="w-20 bg-[#1c1c2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-violet-500/60 transition-all"
                    />
                    <span className="text-xs text-slate-500">% dan yuqori</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sales drop */}
            <div className="px-5 py-4 flex items-start gap-4">
              <Toggle
                checked={settings.salesDrop.enabled}
                onChange={v => update('salesDrop', { enabled: v })}
              />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Savdo tushishi</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Haftalik savdo o'tgan haftaga nisbatan belgilangan foizga tushganda xabar berish
                </p>
                {settings.salesDrop.enabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-slate-400">Tushish chegara:</label>
                    <input
                      type="number"
                      min={5}
                      max={90}
                      value={settings.salesDrop.pctThreshold}
                      onChange={e => update('salesDrop', { pctThreshold: Number(e.target.value) })}
                      className="w-20 bg-[#1c1c2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-violet-500/60 transition-all"
                    />
                    <span className="text-xs text-slate-500">% dan ko'p tushsa</span>
                  </div>
                )}
              </div>
            </div>

            {/* New orders */}
            <div className="px-5 py-4 flex items-start gap-4">
              <Toggle
                checked={settings.newOrders.enabled}
                onChange={v => update('newOrders', { enabled: v })}
              />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Yangi buyurtmalar</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Har bir yangi buyurtma kelganda darhol xabar berish
                </p>
              </div>
            </div>

            {/* Daily summary */}
            <div className="px-5 py-4 flex items-start gap-4">
              <Toggle
                checked={settings.dailySummary.enabled}
                onChange={v => update('dailySummary', { enabled: v })}
              />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Kunlik hisobot</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Daromad, buyurtmalar va qoldiq haqida kunlik xulosa
                </p>
                {settings.dailySummary.enabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-slate-400">Vaqt:</label>
                    <div className="flex items-center gap-1 p-0.5 bg-[#1c1c2e] border border-white/[0.08] rounded-lg">
                      {(['morning', 'evening'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update('dailySummary', { time: t })}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                            settings.dailySummary.time === t
                              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {t === 'morning' ? '🌅 Ertalab (08:00)' : '🌆 Kechqurun (20:00)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Save button */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
          >
            {saving
              ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <Save className="w-4 h-4" />
            }
            Saqlash
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              Saqlandi
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
