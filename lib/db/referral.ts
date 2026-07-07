import { eq } from 'drizzle-orm'
import { db, userSettings } from '@/lib/db'
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

export async function getReferralStats(): Promise<{ stats: ReferralStats; entries: ReferralEntry[] }> {
  const userId = await getCurrentUserId()
  if (!userId) return { stats: EMPTY_STATS, entries: [] }

  const [settings] = await db.select({ referral_code: userSettings.referral_code })
    .from(userSettings)
    .where(eq(userSettings.user_id, userId))

  let code = settings?.referral_code
  if (!code) {
    code = generateCode(userId)
    await db.insert(userSettings).values({
      user_id: userId,
      referral_code: code,
      updated_at: new Date(),
    }).onConflictDoUpdate({
      target: userSettings.user_id,
      set: { referral_code: code, updated_at: new Date() },
    })
  }

  return { stats: { ...EMPTY_STATS, code }, entries: [] }
}
