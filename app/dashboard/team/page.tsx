'use client'

import { useState } from 'react'
import { Users, UserPlus, X, Crown, Eye, Trash2, Shield, Lock } from 'lucide-react'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

// ── Types & mock data ──────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'viewer'

type TeamMember = {
  id: number
  name: string
  email: string
  role: Role
  status: 'active' | 'pending'
  joinedAt: string
  initials: string
  color: string
}

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: 1,
    name: 'Bobur Toshmatov',
    email: 'bobur@example.uz',
    role: 'owner',
    status: 'active',
    joinedAt: '2025-01-15',
    initials: 'BT',
    color: 'from-violet-600 to-indigo-600',
  },
  {
    id: 2,
    name: 'Malika Yusupova',
    email: 'malika@example.uz',
    role: 'admin',
    status: 'active',
    joinedAt: '2025-03-22',
    initials: 'MY',
    color: 'from-emerald-600 to-teal-600',
  },
  {
    id: 3,
    name: 'Jasur Nazarov',
    email: 'jasur@example.uz',
    role: 'viewer',
    status: 'active',
    joinedAt: '2025-05-10',
    initials: 'JN',
    color: 'from-amber-600 to-orange-600',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

type T = typeof translations['uz']['dashboard']

function RoleBadge({ role, d }: { role: Role; d: T }) {
  const config: Record<Role, { label: string; cls: string; icon: React.ReactNode }> = {
    owner:  { label: d.roleOwner,  cls: 'bg-violet-500/15 border-violet-500/30 text-violet-300',  icon: <Crown  className="w-3 h-3" /> },
    admin:  { label: d.roleAdmin,  cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', icon: <Shield className="w-3 h-3" /> },
    viewer: { label: d.roleViewer, cls: 'bg-[var(--bg-card2)] border-[var(--border)] text-[var(--text-muted)]',      icon: <Eye    className="w-3 h-3" /> },
  }
  const c = config[role]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  )
}

function StatusDot({ status, d }: { status: 'active' | 'pending'; d: T }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {status === 'active' ? d.teamActive : d.teamPending}
    </span>
  )
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose, d }: { onClose: () => void; d: T }) {
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState<'admin' | 'viewer'>('viewer')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSuccess(true)
      setTimeout(onClose, 1200)
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-violet-400" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.teamInviteTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
              {d.teamEmailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
              {d.teamRoleLabel}
            </label>
            <div className="space-y-2">
              {([
                { value: 'admin',  label: d.roleAdmin,  desc: d.roleAdminDesc },
                { value: 'viewer', label: d.roleViewer, desc: d.roleViewerDesc },
              ] as { value: 'admin' | 'viewer'; label: string; desc: string }[]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    role === opt.value
                      ? 'bg-violet-600/15 border-violet-500/40'
                      : 'bg-[var(--bg-card2)] border-[var(--border)] hover:border-[var(--border2)]'
                  }`}
                >
                  <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                    role === opt.value
                      ? 'border-violet-400 bg-violet-400'
                      : 'border-[var(--border2)]'
                  }`} />
                  <div>
                    <p className={`text-xs font-semibold ${role === opt.value ? 'text-violet-300' : 'text-[var(--text-dim)]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {success ? (
            <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              {d.teamInviteSent}
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[var(--text-base)] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-[var(--border2)] border-t-white animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {d.teamSendInvite}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [members, setMembers] = useState<TeamMember[]>([])
  const [showModal, setShowModal] = useState(false)
  const isPro = false  // mock: not on Pro+

  function handleRemove(id: number) {
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.teamTitle}</h1>
            <HelpTooltip section="team" />
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {d.teamSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Lock className="w-3 h-3" />
              {d.teamProBadge}
            </span>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={!isPro}
            title={!isPro ? d.teamUpgrade : ''}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-base)] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {d.teamAddMember}
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: <Crown  className="w-4 h-4 text-violet-400" />, label: d.roleOwner,  desc: d.roleOwnerDesc },
          { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: d.roleAdmin, desc: d.roleAdminDesc },
          { icon: <Eye    className="w-4 h-4 text-[var(--text-muted)]" />,  label: d.roleViewer, desc: d.roleViewerDesc },
        ].map(r => (
          <div key={r.label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5">{r.icon}</div>
            <div>
              <p className="text-[var(--text-base)] text-xs font-semibold">{r.label}</p>
              <p className="text-[var(--text-muted)] text-[11px] mt-0.5">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Members list */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.teamMembers}</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{members.length} {d.teamMembersCount}</span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {members.map(member => (
            <div key={member.id} className="px-5 py-4 flex items-center gap-4 hover:bg-[var(--bg-card2)] transition-colors">
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${member.color} flex items-center justify-center flex-shrink-0`}>
                <span className="text-[var(--text-base)] font-bold text-sm">{member.initials}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[var(--text-base)] font-semibold text-sm">{member.name}</p>
                  <RoleBadge role={member.role} d={d} />
                </div>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{member.email}</p>
              </div>

              {/* Status */}
              <div className="hidden sm:block">
                <StatusDot status={member.status} d={d} />
              </div>

              {/* Joined */}
              <div className="hidden md:block text-[var(--text-muted)] text-xs">
                {new Date(member.joinedAt).toLocaleDateString('uz-UZ')}
              </div>

              {/* Remove button */}
              {member.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={!isPro}
                  title={!isPro ? d.teamProBadge : d.teamRemove}
                  className="text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1.5 rounded-lg hover:bg-red-500/[0.08]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pro upsell */}
      {!isPro && (
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-[var(--text-base)] font-semibold text-sm mb-1">{d.teamLockedTitle}</p>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed">
              {d.teamLockedDesc}
            </p>
          </div>
        </div>
      )}

      {showModal && <InviteModal onClose={() => setShowModal(false)} d={d} />}
    </div>
  )
}
