'use client'

import { useState } from 'react'
import { Copy, Check, Users, Gift, Clock, TrendingUp } from 'lucide-react'
import type { ReferralStats, ReferralEntry } from '@/lib/db/referral'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function fs(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

function statusLabel(s: ReferralEntry['status'], t: { statusActive: string; statusPaid: string; statusPending: string }) {
  return s === 'active' ? t.statusActive : s === 'paid' ? t.statusPaid : t.statusPending
}
function statusCls(s: ReferralEntry['status']) {
  return s === 'active'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : s === 'paid'
    ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
    : 'bg-[var(--bg-card2)] text-[var(--text-muted)] border-[var(--border)]'
}

interface Props {
  stats:   ReferralStats
  entries: ReferralEntry[]
}

export default function ReferralView({ stats, entries }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].referral
  const [copied, setCopied] = useState(false)
  const referralUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/signup?ref=${stats.code}`
    : `https://daromadchi.uz/signup?ref=${stats.code}`

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* How it works */}
      <div className="bg-gradient-to-br from-violet-600/10 to-violet-500/5 border border-violet-500/20 rounded-2xl p-6">
        <p className="text-sm font-semibold text-violet-300 mb-4">{t.howTitle}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Copy,  step: '1', text: t.step1 },
            { icon: Users, step: '2', text: t.step2 },
            { icon: Gift,  step: '3', text: t.step3 },
          ].map(({ icon: Icon, step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-violet-300">{step}</span>
              </div>
              <p className="text-sm text-[var(--text-dim)]">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link card */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        <p className="text-xs font-semibold text-[var(--text-muted)]">Sizning referal havolangiz</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 px-4 py-3 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl font-mono text-sm text-violet-300 truncate">
            {referralUrl}
          </div>
          <button onClick={copyLink}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              copied
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'btn-primary'
            }`}>
            {copied ? <><Check className="w-4 h-4" /> {t.copiedBtn}</> : <><Copy className="w-4 h-4" /> {t.copyBtn}</>}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="px-2 py-1 bg-[var(--bg-card2)] rounded-lg font-mono text-violet-400 font-semibold">{stats.code}</span>
          <span>— sizning kodingiz</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jami taklif',    value: String(stats.totalReferred),  icon: Users,      color: 'text-[var(--text-base)]'       },
          { label: 'Faol',           value: String(stats.activeReferred),  icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Kutilmoqda',     value: String(stats.pendingReferred), icon: Clock,      color: 'text-amber-400'   },
          { label: 'Jami mukofot',   value: fs(stats.totalReward),         icon: Gift,       color: 'text-violet-400'  },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <Icon className={`w-4 h-4 ${color} opacity-60`} />
            </div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Entries table */}
      {entries.length > 0 && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Taklif qilingan foydalanuvchilar</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Sana</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Holat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Faollashdi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Mukofot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">#{i + 1}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                      {new Date(entry.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCls(entry.status)}`}>
                        {statusLabel(entry.status, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                      {entry.activatedAt ? new Date(entry.activatedAt).toLocaleDateString('uz-UZ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {entry.rewardAmount > 0
                        ? <span className="text-emerald-400">+{fs(entry.rewardAmount)}</span>
                        : <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <Gift className="w-8 h-8 text-violet-400/50 mx-auto mb-3" />
          <p className="text-[var(--text-base)] font-semibold mb-1">Hali hech kim taklif qilinmagan</p>
          <p className="text-[var(--text-muted)] text-sm">Yuqoridagi havolani ulashing va mukofot oling</p>
        </div>
      )}
    </div>
  )
}
