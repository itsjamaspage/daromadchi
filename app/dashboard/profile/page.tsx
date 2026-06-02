'use client'

import { useState } from 'react'
import {
  UserCircle, Shield, BookOpen, CheckCircle, Eye, EyeOff,
  Monitor, Smartphone, X, LogOut, Save,
} from 'lucide-react'

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

// ── Mock data ──────────────────────────────────────────────────────────────────

type Session = {
  id: number
  device: string
  ip: string
  lastActive: string
  icon: 'desktop' | 'mobile'
}

const MOCK_SESSIONS: Session[] = [
  { id: 1, device: 'Chrome / Windows',  ip: '192.168.1.1',  lastActive: 'Hozir',         icon: 'desktop' },
  { id: 2, device: 'Safari / iPhone',   ip: '10.0.0.22',    lastActive: '2 soat oldin',   icon: 'mobile'  },
  { id: 3, device: 'Firefox / Linux',   ip: '203.100.42.5', lastActive: 'Kecha',          icon: 'desktop' },
]

type LogRow = {
  id: number
  timestamp: string
  event: string
  ip: string
  device: string
  type: 'login' | 'password' | 'logout' | 'api'
}

const MOCK_LOGS: LogRow[] = [
  { id: 1, timestamp: '2026-06-01 09:14',  event: 'Kirish',                  ip: '192.168.1.1',  device: 'Chrome / Windows',  type: 'login'    },
  { id: 2, timestamp: '2026-05-31 20:02',  event: 'Chiqish',                 ip: '10.0.0.22',    device: 'Safari / iPhone',   type: 'logout'   },
  { id: 3, timestamp: '2026-05-31 18:45',  event: 'Kirish',                  ip: '10.0.0.22',    device: 'Safari / iPhone',   type: 'login'    },
  { id: 4, timestamp: '2026-05-30 11:22',  event: "Parol o'zgartirildi",     ip: '192.168.1.1',  device: 'Chrome / Windows',  type: 'password' },
  { id: 5, timestamp: '2026-05-29 14:37',  event: 'API token yangilandi',    ip: '192.168.1.1',  device: 'Chrome / Windows',  type: 'api'      },
  { id: 6, timestamp: '2026-05-28 08:55',  event: 'Kirish',                  ip: '203.100.42.5', device: 'Firefox / Linux',   type: 'login'    },
  { id: 7, timestamp: '2026-05-27 22:11',  event: 'Chiqish',                 ip: '192.168.1.1',  device: 'Chrome / Windows',  type: 'logout'   },
  { id: 8, timestamp: '2026-05-26 09:04',  event: 'Kirish',                  ip: '192.168.1.1',  device: 'Chrome / Windows',  type: 'login'    },
]

// ── Tab: Profil ────────────────────────────────────────────────────────────────

function ProfileTab() {
  const [name,  setName]   = useState('Bobur Toshmatov')
  const [email, setEmail]  = useState('bobur@example.uz')
  const [phone, setPhone]  = useState('+998 90 123 45 67')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
    }, 700)
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <span className="text-[var(--text-base)] font-bold text-2xl">BT</span>
          </div>
          <button className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-white/[0.18] px-3 py-1.5 rounded-lg transition-all">
            + Rasm yuklash
          </button>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-bold text-lg">{name}</p>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{email}</p>
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <CheckCircle className="w-3 h-3" /> Pro tarif
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">Shaxsiy ma&apos;lumotlar</h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Ism va familiya</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Email manzil</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all pr-36"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle className="w-3 h-3" /> Tasdiqlangan
              </span>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Telefon raqami</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+998"
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[var(--text-base)] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
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
        </div>
      </form>
    </div>
  )
}

// ── Tab: Xavfsizlik ────────────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPws,    setShowPws]    = useState(false)

  const [twoFA,      setTwoFA]      = useState(false)
  const [otpCode,    setOtpCode]    = useState('')

  const [sessions,   setSessions]   = useState(MOCK_SESSIONS)

  const [pwSaved,    setPwSaved]    = useState(false)
  const [pwSaving,   setPwSaving]   = useState(false)

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwSaving(true)
    setTimeout(() => {
      setPwSaving(false)
      setPwSaved(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }, 800)
  }

  function handleRemoveSession(id: number) {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Password change */}
      <form onSubmit={handlePwSubmit} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">Parolni o&apos;zgartirish</h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Toggle show passwords */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowPws(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors"
            >
              {showPws ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPws ? "Yashirish" : "Ko'rsatish"}
            </button>
          </div>

          {[
            { label: 'Joriy parol',  value: currentPw,  setter: setCurrentPw  },
            { label: 'Yangi parol',  value: newPw,      setter: setNewPw      },
            { label: 'Tasdiqlash',   value: confirmPw,  setter: setConfirmPw  },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{field.label}</label>
              <input
                type={showPws ? 'text' : 'password'}
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                required
                className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pwSaving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[var(--text-base)] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
            >
              {pwSaving
                ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <Shield className="w-4 h-4" />
              }
              Parolni o&apos;zgartirish
            </button>
            {pwSaved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Saqlandi
              </span>
            )}
          </div>
        </div>
      </form>

      {/* 2FA */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">Ikki faktorli autentifikatsiya</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[var(--text-base)] text-sm font-medium">2FA holati</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">
                {twoFA ? 'Yoqilgan — Google Authenticator bilan himoyalangan' : 'O\'chirilgan'}
              </p>
            </div>
            <Toggle checked={twoFA} onChange={setTwoFA} />
          </div>

          {twoFA && (
            <div className="space-y-4 pt-2 border-t border-white/[0.05]">
              {/* QR mockup */}
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-40 h-40 rounded-xl bg-white/[0.06] border border-[var(--border2)] flex flex-col items-center justify-center gap-2">
                  <div className="w-24 h-24 bg-white/[0.08] rounded-lg grid grid-cols-5 gap-0.5 p-2">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-[2px] ${[0,1,3,5,9,10,12,14,15,19,21,23,24].includes(i) ? 'bg-white/70' : 'bg-transparent'}`}
                      />
                    ))}
                  </div>
                  <p className="text-[var(--text-muted)] text-[10px] text-center px-2">Google Authenticator</p>
                </div>
                <p className="text-[var(--text-muted)] text-xs text-center max-w-xs">
                  Google Authenticator ilovasini oching va QR kodni skanerlang
                </p>
              </div>

              {/* OTP input */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Kodni kiriting</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-[var(--text-base)] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Tasdiqlash
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <Monitor className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">Faol seanslar</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{sessions.length} ta</span>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {sessions.map(session => (
            <div key={session.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                {session.icon === 'mobile'
                  ? <Smartphone className="w-4 h-4 text-[var(--text-muted)]" />
                  : <Monitor    className="w-4 h-4 text-[var(--text-muted)]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-base)] text-sm font-medium">{session.device}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">IP: {session.ip}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-medium ${session.lastActive === 'Hozir' ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                  {session.lastActive}
                </p>
              </div>
              {session.id !== 1 && (
                <button
                  onClick={() => handleRemoveSession(session.id)}
                  className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/[0.08]"
                  title="O'chirish"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-white/[0.05]">
          <button
            onClick={() => setSessions(prev => prev.filter(s => s.id === 1))}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 text-sm font-medium px-4 py-2 rounded-xl transition-all hover:bg-red-500/[0.06]"
          >
            <LogOut className="w-4 h-4" />
            Barchadan chiqish
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Xavfsizlik jurnali ────────────────────────────────────────────────────

function SecurityLogTab() {
  function eventColor(type: LogRow['type']) {
    if (type === 'login')    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (type === 'password') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    if (type === 'logout')   return 'text-red-400 bg-red-500/10 border-red-500/20'
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-violet-400" />
        <h2 className="text-[var(--text-base)] font-semibold text-sm">Xavfsizlik jurnali</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-muted)] text-xs border-b border-white/[0.05] bg-white/[0.01]">
              <th className="text-left font-medium px-5 py-3">Vaqt</th>
              <th className="text-left font-medium px-4 py-3">Hodisa</th>
              <th className="text-left font-medium px-4 py-3">IP manzil</th>
              <th className="text-left font-medium px-4 py-3">Qurilma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {MOCK_LOGS.map(row => (
              <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs font-mono">{row.timestamp}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${eventColor(row.type)}`}>
                    {row.event}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs font-mono">{row.ip}</td>
                <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs">{row.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'profil' | 'xavfsizlik' | 'jurnal'

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('profil')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profil',      label: 'Profil',              icon: <UserCircle className="w-3.5 h-3.5" /> },
    { key: 'xavfsizlik',  label: 'Xavfsizlik',          icon: <Shield     className="w-3.5 h-3.5" /> },
    { key: 'jurnal',      label: 'Xavfsizlik jurnali',  icon: <BookOpen   className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">Profil</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Shaxsiy ma&apos;lumotlar va xavfsizlik sozlamalari
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profil'     && <ProfileTab />}
      {activeTab === 'xavfsizlik' && <SecurityTab />}
      {activeTab === 'jurnal'     && <SecurityLogTab />}
    </div>
  )
}
