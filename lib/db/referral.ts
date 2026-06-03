import { createClient } from '@/lib/supabase/server'

export interface ReferralStats {
  code: string
  totalReferred: number
  activeReferred: number
  pendingReferred: number
  totalReward: number
}

export interface ReferralEntry {
  id: string
  status: 'pending' | 'active' | 'paid'
  rewardAmount: number
  createdAt: string
  activatedAt: string | null
}

function generateCode(userId: string): string {
  // deterministic-ish short code from user id
  const hash = userId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `DR${hash}`
}

const EMPTY_STATS: ReferralStats = {
  code:            '',
  totalReferred:   0,
  activeReferred:  0,
  pendingReferred: 0,
  totalReward:     0,
}

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getReferralStats(): Promise<{ stats: ReferralStats; entries: ReferralEntry[] }> {
  if (!supabaseConfigured) return { stats: EMPTY_STATS, entries: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { stats: EMPTY_STATS, entries: [] }

  // Ensure referral code exists
  const { data: settings } = await supabase
    .from('user_settings')
    .select('referral_code')
    .eq('user_id', user.id)
    .single()

  let code = settings?.referral_code as string | null
  if (!code) {
    code = generateCode(user.id)
    await supabase.from('user_settings').upsert({ user_id: user.id, referral_code: code })
  }

  const { data: rows } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false })

  const entries: ReferralEntry[] = (rows ?? []).map(r => ({
    id:           r.id as string,
    status:       r.status as ReferralEntry['status'],
    rewardAmount: Number(r.reward_amount),
    createdAt:    r.created_at as string,
    activatedAt:  r.activated_at as string | null,
  }))

  const stats: ReferralStats = {
    code,
    totalReferred:   entries.length,
    activeReferred:  entries.filter(e => e.status === 'active' || e.status === 'paid').length,
    pendingReferred: entries.filter(e => e.status === 'pending').length,
    totalReward:     entries.reduce((s, e) => s + e.rewardAmount, 0),
  }

  return { stats, entries }
}
