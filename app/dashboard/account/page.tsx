import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Calendar, Shield, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'
import { getUserPlanFull } from '@/lib/api/auth'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const lang = await getLang()
  const t = dashT[lang].account

  const planFull = await getUserPlanFull(user.id)
  const { plan, effectivePlan, planExpiresAt, trialEndsAt, isOnTrial } = planFull

  const joinedAt = new Date(user.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
  const expiresAt = planExpiresAt
    ? new Date(planExpiresAt).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const trialExpired = !isOnTrial && trialEndsAt !== null && plan === 'free'
  const nowMs = trialEndsAt ? new Date(trialEndsAt).getTime() - new Date().getTime() : 0
  const trialDaysLeft = isOnTrial && trialEndsAt ? Math.ceil(nowMs / 86400000) : 0

  const planLabel: Record<string, { label: string; color: string }> = {
    free:     { label: t.planFree,    color: 'text-[var(--text-muted)] bg-slate-500/10 border-[var(--border)]' },
    pro:      { label: t.planPro,     color: 'text-[var(--c1)] bg-[var(--bg-card2)] border-[var(--border)]' },
    pro_plus: { label: t.planProPlus, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  }
  const planInfo = planLabel[effectivePlan] ?? planLabel.free

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{t.title}</h1>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${planInfo.color}`}>
            {planInfo.label}
          </span>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{t.subtitle}</p>
      </div>

      {/* Avatar + name */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ background: 'var(--c1)' }}>
          <User className="w-8 h-8 text-[var(--text-base)]" />
        </div>
        <div>
          <p className="text-[var(--text-base)] font-bold text-lg">
            {user.user_metadata?.full_name ?? t.defaultUser}
          </p>
          <p className="text-[var(--text-muted)] text-sm flex items-center gap-1.5 mt-0.5">
            <Mail className="w-3.5 h-3.5" /> {user.email}
          </p>
          <p className="text-[var(--text-muted)] text-xs flex items-center gap-1.5 mt-1">
            <Calendar className="w-3 h-3" /> {t.joined} {joinedAt}
          </p>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-base)] font-semibold text-sm">{t.planTitle}</p>
        </div>

        {/* Trial active banner */}
        {isOnTrial && (
          <div className="mx-6 mt-5 flex items-center justify-between gap-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
            <p className="text-emerald-400 text-sm font-medium">
              Pro tarifni 3 kun bepul sinayapsiz. {trialDaysLeft} kun qoldi.
            </p>
            <Link href="/pricing"
              className="btn-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              {t.upgradePro}
            </Link>
          </div>
        )}

        {/* Trial expired banner */}
        {trialExpired && (
          <div className="mx-6 mt-5 flex items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
            <p className="text-amber-400 text-sm font-medium">
              Bepul sinov tugadi. Pro tarifga o&apos;tib barcha imkoniyatlardan foydalaning.
            </p>
            <Link href="/pricing"
              className="btn-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              {t.upgradePro}
            </Link>
          </div>
        )}

        <div className="p-6 flex items-center justify-between">
          <div>
            <span className={`text-sm font-bold px-3 py-1.5 rounded-xl border ${planInfo.color}`}>
              {planInfo.label}
            </span>
            {expiresAt && (
              <p className="text-[var(--text-muted)] text-xs mt-2">{t.expires} {expiresAt}</p>
            )}
            {effectivePlan === 'free' && !isOnTrial && (
              <p className="text-[var(--text-muted)] text-xs mt-2">{t.freeDesc}</p>
            )}
            {effectivePlan === 'pro' && !isOnTrial && (
              <p className="text-[var(--text-muted)] text-xs mt-2">{t.proDesc}</p>
            )}
            {effectivePlan === 'pro_plus' && (
              <p className="text-[var(--text-muted)] text-xs mt-2">{t.proPlusDesc}</p>
            )}
          </div>
          {effectivePlan === 'free' && !isOnTrial && (
            <Link href="/pricing"
              className="btn-primary text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              {t.upgradePro}
            </Link>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <Shield className="w-4 h-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-base)] font-semibold text-sm">{t.security}</p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--text-base)] text-sm font-medium">{t.password}</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{t.passwordDesc}</p>
            </div>
            <Link href="/login?forgot=1"
              className="text-sm font-medium transition-colors border border-[var(--border)] px-3 py-1.5 rounded-xl hover:bg-[var(--bg-card2)]"
              style={{ color: 'var(--c1)' }}>
              {t.change}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
