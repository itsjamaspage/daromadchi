import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Calendar, Shield, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('plan, plan_expires_at, created_at')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const joinedAt = new Date(user.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
  const expiresAt = profile?.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const planLabel: Record<string, { label: string; color: string }> = {
    free:     { label: 'Bepul',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
    pro:      { label: 'Pro',    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    pro_plus: { label: 'Pro+',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  }
  const planInfo = planLabel[plan] ?? planLabel.free

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-white">Profil</h1>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${planInfo.color}`}>
            {planInfo.label}
          </span>
        </div>
        <p className="text-slate-400 text-sm">Akkaunt ma'lumotlari va tarif rejasi</p>
      </div>

      {/* Avatar + name */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-lg">
            {user.user_metadata?.full_name ?? 'Foydalanuvchi'}
          </p>
          <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-0.5">
            <Mail className="w-3.5 h-3.5" /> {user.email}
          </p>
          <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-1">
            <Calendar className="w-3 h-3" /> Ro'yxatdan o'tgan: {joinedAt}
          </p>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.05] flex items-center gap-3">
          <CreditCard className="w-4 h-4 text-slate-400" />
          <p className="text-white font-semibold text-sm">Tarif rejasi</p>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <span className={`text-sm font-bold px-3 py-1.5 rounded-xl border ${planInfo.color}`}>
              {planInfo.label}
            </span>
            {expiresAt && (
              <p className="text-slate-500 text-xs mt-2">Muddati: {expiresAt}</p>
            )}
            {plan === 'free' && (
              <p className="text-slate-500 text-xs mt-2">1 do'kon · 7 kunlik tarix</p>
            )}
            {plan === 'pro' && (
              <p className="text-slate-500 text-xs mt-2">3 do'kon · Cheksiz tarix</p>
            )}
            {plan === 'pro_plus' && (
              <p className="text-slate-500 text-xs mt-2">5 do'kon · Cheksiz tarix · Ustuvor qo'llab-quvvatlash</p>
            )}
          </div>
          {plan === 'free' && (
            <Link href="/pricing"
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              Pro ga o'tish →
            </Link>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.05] flex items-center gap-3">
          <Shield className="w-4 h-4 text-slate-400" />
          <p className="text-white font-semibold text-sm">Xavfsizlik</p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Parol</p>
              <p className="text-slate-500 text-xs mt-0.5">Parolingizni o'zgartiring</p>
            </div>
            <Link href="/login?forgot=1"
              className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors border border-violet-500/20 px-3 py-1.5 rounded-xl hover:bg-violet-500/10">
              O'zgartirish
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
