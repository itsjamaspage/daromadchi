import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAuthUser(authHeader: string | null): Promise<User | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user ?? null
}

export async function getShopIds(userId: string, shopId?: string | null): Promise<string[]> {
  let q = supabaseAdmin.from('shops').select('id').eq('user_id', userId)
  if (shopId) q = q.eq('id', shopId)
  const { data } = await q
  return (data ?? []).map((s: { id: string }) => s.id)
}

export type Plan = 'free' | 'pro' | 'pro_plus'

export const PLAN_SHOP_LIMITS: Record<Plan, number> = {
  free:     1,
  pro:      3,
  pro_plus: 5,
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('plan, plan_expires_at, trial_ends_at')
    .eq('id', userId)
    .maybeSingle()

  const plan = (data?.plan ?? 'free') as Plan

  // Paid plan expiry check
  if (plan !== 'free' && data?.plan_expires_at) {
    if (new Date(data.plan_expires_at) < new Date()) return 'free'
  }

  // Trial logic (only for free plan users)
  if (plan === 'free') {
    if (!data?.trial_ends_at) {
      // Auto-start 3-day trial for first-time users
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      await supabaseAdmin.from('users').update({ trial_ends_at: trialEnd }).eq('id', userId)
      return 'pro'
    }
    if (new Date(data.trial_ends_at) > new Date()) {
      return 'pro' // Trial still active
    }
  }

  return plan
}

export interface PlanInfo {
  plan: Plan
  effectivePlan: Plan
  planExpiresAt: string | null
  trialEndsAt: string | null
  isOnTrial: boolean
}

export async function getUserPlanFull(userId: string): Promise<PlanInfo> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('plan, plan_expires_at, trial_ends_at')
    .eq('id', userId)
    .maybeSingle()

  const plan = (data?.plan ?? 'free') as Plan
  const planExpiresAt = data?.plan_expires_at ?? null
  const trialEndsAt = data?.trial_ends_at ?? null

  let effectivePlan: Plan = plan

  // Paid plan expiry check
  if (plan !== 'free' && planExpiresAt) {
    if (new Date(planExpiresAt) < new Date()) effectivePlan = 'free'
  }

  let isOnTrial = false

  // Trial logic (only for free plan users)
  if (plan === 'free') {
    if (!trialEndsAt) {
      // Auto-start 3-day trial for first-time users
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      await supabaseAdmin.from('users').update({ trial_ends_at: trialEnd }).eq('id', userId)
      effectivePlan = 'pro'
      isOnTrial = true
      return { plan, effectivePlan, planExpiresAt, trialEndsAt: trialEnd, isOnTrial }
    }
    if (new Date(trialEndsAt) > new Date()) {
      effectivePlan = 'pro'
      isOnTrial = true
    }
  }

  return { plan, effectivePlan, planExpiresAt, trialEndsAt, isOnTrial }
}
