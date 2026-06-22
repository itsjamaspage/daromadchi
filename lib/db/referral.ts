import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'

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

  const userId = await getCurrentUserId()
  if (!userId) return { stats: EMPTY_STATS, entries: [] }

  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('user_settings')
    .select('referral_code')
    .eq('user_id', userId)
    .single()

  let code = settings?.referral_code as string | null
  if (!code) {
    code = generateCode(userId)
    await supabase.from('user_settings').upsert({ user_id: userId, referral_code: code })
  }

  const { data: rows } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_user_id', userId)
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
