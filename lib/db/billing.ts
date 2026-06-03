import { createClient } from '@/lib/supabase/server'

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

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getBilling(): Promise<BillingInfo> {
  const empty: BillingInfo = {
    plan: 'free', planExpiresAt: null, isOnTrial: false, trialEndsAt: null, payments: [],
  }
  if (!supabaseConfigured) return empty

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty

  const [{ data: userRow }, { data: paymentRows }] = await Promise.all([
    supabase
      .from('users')
      .select('plan, plan_expires_at, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('id, plan, amount, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const plan = (userRow?.plan ?? 'free') as PlanType
  const planExpiresAt = (userRow?.plan_expires_at as string) ?? null
  const trialEndsAt = (userRow?.trial_ends_at as string) ?? null
  const isOnTrial = !!trialEndsAt && new Date(trialEndsAt) > new Date() && plan === 'free'

  const payments: PaymentRecord[] = (paymentRows ?? []).map(p => ({
    id:     p.id as string,
    date:   p.created_at as string,
    plan:   p.plan as string,
    amount: Number(p.amount),
    status: p.status as PaymentRecord['status'],
  }))

  return { plan, planExpiresAt, isOnTrial, trialEndsAt, payments }
}
