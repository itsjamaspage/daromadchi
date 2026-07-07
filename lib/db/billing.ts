import { eq, desc } from 'drizzle-orm'
import { db, users, payments } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'

export type PlanType = 'free' | 'pro' | 'pro_plus'

export interface PaymentRecord {
  id: string
  date: string
  plan: string
  amount: number
  status: 'pending' | 'paid' | 'cancelled' | 'failed'
}

export interface BillingInfo {
  plan: PlanType
  planExpiresAt: string | null
  isOnTrial: boolean
  trialEndsAt: string | null
  payments: PaymentRecord[]
}

export async function getBilling(): Promise<BillingInfo> {
  const empty: BillingInfo = {
    plan: 'free', planExpiresAt: null, isOnTrial: false, trialEndsAt: null, payments: [],
  }

  const userId = await getCurrentUserId()
  if (!userId) return empty

  const [[userRow], paymentRows] = await Promise.all([
    db.select({
      plan: users.plan,
      plan_expires_at: users.plan_expires_at,
      trial_ends_at: users.trial_ends_at,
    }).from(users).where(eq(users.id, userId)),
    db.select({
      id: payments.id,
      plan: payments.plan,
      amount: payments.amount,
      status: payments.status,
      created_at: payments.created_at,
    }).from(payments)
      .where(eq(payments.user_id, userId))
      .orderBy(desc(payments.created_at)),
  ])

  const plan = (userRow?.plan ?? 'free') as PlanType
  const planExpiresAt = userRow?.plan_expires_at?.toISOString() ?? null
  const trialEndsAt = userRow?.trial_ends_at?.toISOString() ?? null
  const isOnTrial = !!trialEndsAt && new Date(trialEndsAt) > new Date() && plan === 'free'

  const paymentList: PaymentRecord[] = paymentRows.map(p => ({
    id:     p.id,
    date:   p.created_at.toISOString(),
    plan:   p.plan,
    amount: Number(p.amount),
    status: p.status as PaymentRecord['status'],
  }))

  return { plan, planExpiresAt, isOnTrial, trialEndsAt, payments: paymentList }
}
