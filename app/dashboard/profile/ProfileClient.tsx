'use client'

import { useState } from 'react'
import {
  UserCircle, Shield, BookOpen, CheckCircle, Eye, EyeOff,
  Monitor, Smartphone, X, LogOut, Save,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { UserProfile } from '@/lib/db/profile'

type T = typeof translations['uz']['dashboard']

// ── Toggle component ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-[var(--c1)]' : 'bg-[var(--bg-input)]'
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

// ── Types ───────────────────────────────────────────────────────────────────────
// Login sessions and the security log require a server-side audit pipeline that
// isn't built yet — these tabs show honest empty states rather than fabricated rows.

type Session = {
  id: number
  device: string
  ip: string
  lastActive: string
  icon: 'desktop' | 'mobile'
}

type LogRow = {
  id: number
  timestamp: string
  event: string
  ip: string
  device: string
  type: 'login' | 'password' | 'logout' | 'api'
}

// ── Tab: Profil ────────────────────────────────────────────────────────────────

function initialsFrom(name: string, email: string): string {
  const base = name.trim() || email.trim()
  if (!base) return '—'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function ProfileTab({ d, profile }: { d: T; profile: UserProfile }) {
  const [name,  setName]   = useState(profile.fullName)
  const [email, setEmail]  = useState(profile.email)
  const [phone, setPhone]  = useState(profile.phone)
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
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'var(--c1)' }}>
          <span className="text-[var(--text-base)] font-bold text-2xl">{initialsFrom(name, email)}</span>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-bold text-lg">{name}</p>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{email}</p>
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <CheckCircle className="w-3 h-3" /> {d.profilePlanPro}
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <UserCircle className="w-4 h-4" style={{ color: 'var(--c1)' }} />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.profilePersonalInfo}</h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.profileFullName}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.profileEmail}</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all pr-36"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle className="w-3 h-3" /> {d.profileVerified}
              </span>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.profilePhone}</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+998"
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 disabled:opacity-50 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg btn-primary"
            >
              {saving
                ? <span className="w-4 h-4 rounded-full border-2 border-[var(--border2)] border-t-white animate-spin" />
                : <Save className="w-4 h-4" />
              }
              {d.save}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                {d.profileSaved}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Tab: Xavfsizlik ────────────────────────────────────────────────────────────

function SecurityTab({ d }: { d: T }) {
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPws,    setShowPws]    = useState(false)

  const [twoFA,      setTwoFA]      = useState(false)
  const [otpCode,    setOtpCode]    = useState('')

  const [sessions,   setSessions]   = useState<Session[]>([])

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
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--c1)' }} />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.profileChangePassword}</h2>
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
              {showPws ? d.profileHide : d.profileShow}
            </button>
          </div>

          {[
            { label: d.profileCurrentPw,  value: currentPw,  setter: setCurrentPw  },
            { label: d.profileNewPw,      value: newPw,      setter: setNewPw      },
            { label: d.profileConfirmPw,  value: confirmPw,  setter: setConfirmPw  },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{field.label}</label>
              <input
                type={showPws ? 'text' : 'password'}
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                required
                className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all"
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pwSaving}
              className="flex items-center gap-2 disabled:opacity-50 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg btn-primary"
            >
              {pwSaving
                ? <span className="w-4 h-4 rounded-full border-2 border-[var(--border2)] border-t-white animate-spin" />
                : <Shield className="w-4 h-4" />
              }
              {d.profileChangePassword}
            </button>
            {pwSaved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle className="w-4 h-4" /> {d.profileSaved}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* 2FA */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.profile2faTitle}</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[var(--text-base)] text-sm font-medium">{d.profile2faStatus}</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">
                {twoFA ? d.profile2faOn : d.profile2faOff}
              </p>
            </div>
            <Toggle checked={twoFA} onChange={setTwoFA} />
          </div>

          {twoFA && (
            <div className="space-y-4 pt-2 border-t border-[var(--border)]">
              {/* QR mockup */}
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-40 h-40 rounded-xl bg-[var(--bg-input)] border border-[var(--border2)] flex flex-col items-center justify-center gap-2">
                  <div className="w-24 h-24 bg-[var(--bg-input)] rounded-lg grid grid-cols-5 gap-0.5 p-2">
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
                  {d.profile2faScan}
                </p>
              </div>

              {/* OTP input */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.profileEnterCode}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    className="flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {d.profileConfirm}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Monitor className="w-4 h-4" style={{ color: 'var(--c1)' }} />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.profileActiveSessions}</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{sessions.length}</span>
        </div>
        {sessions.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-sm">{d.profileNoSessions}</div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)]">
              {sessions.map(session => (
                <div key={session.id} className="px-5 py-4 flex items-center gap-4 hover:bg-[var(--bg-card2)] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
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
                      {session.lastActive === 'Hozir' ? d.profileNow : session.lastActive}
                    </p>
                  </div>
                  {session.id !== 1 && (
                    <button
                      onClick={() => handleRemoveSession(session.id)}
                      className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/[0.08]"
                      title={d.devicesDelete}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => setSessions(prev => prev.filter(s => s.id === 1))}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 text-sm font-medium px-4 py-2 rounded-xl transition-all hover:bg-red-500/[0.06]"
              >
                <LogOut className="w-4 h-4" />
                {d.profileLogoutAll}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Tab: Xavfsizlik jurnali ────────────────────────────────────────────────────

function SecurityLogTab({ d }: { d: T }) {
  const logs: LogRow[] = []

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
        <BookOpen className="w-4 h-4" style={{ color: 'var(--c1)' }} />
        <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.profileSecurityLog}</h2>
      </div>
      {logs.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)] text-sm">{d.profileNoLog}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left font-medium px-5 py-3">{d.profileColTime}</th>
                <th className="text-left font-medium px-4 py-3">{d.profileColEvent}</th>
                <th className="text-left font-medium px-4 py-3">{d.profileColIp}</th>
                <th className="text-left font-medium px-4 py-3">{d.profileColDevice}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {logs.map(row => (
                <tr key={row.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                  <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs font-mono">{row.timestamp}</td>
                  <td className="px-4 py-3.5 text-[var(--text-base)] text-xs">{row.event}</td>
                  <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs font-mono">{row.ip}</td>
                  <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs">{row.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'profil' | 'xavfsizlik' | 'jurnal'

export default function ProfileClient({ profile }: { profile: UserProfile }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [activeTab, setActiveTab] = useState<Tab>('profil')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profil',      label: d.profileTabProfile,   icon: <UserCircle className="w-3.5 h-3.5" /> },
    { key: 'xavfsizlik',  label: d.profileTabSecurity,  icon: <Shield     className="w-3.5 h-3.5" /> },
    { key: 'jurnal',      label: d.profileTabLog,       icon: <BookOpen   className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.profileTitle}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          {d.profileSubtitle}
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
                ? 'border border-[var(--border)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
            style={activeTab === t.key ? { background: 'var(--bg-card2)', color: 'var(--c1)' } : {}}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profil'     && <ProfileTab d={d} profile={profile} />}
      {activeTab === 'xavfsizlik' && <SecurityTab d={d} />}
      {activeTab === 'jurnal'     && <SecurityLogTab d={d} />}
    </div>
  )
}
