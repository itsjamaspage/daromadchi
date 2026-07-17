import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { eq, ne, and, or, isNull } from 'drizzle-orm'
import { db, shops, users } from '@/lib/db'

let _supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabaseAdmin
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client as object, prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export async function getAuthUser(authHeader: string | null): Promise<User | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user ?? null
}

export async function getExtensionUser(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token.length < 20) return null
  const [user] = await db.select().from(users).where(eq(users.extension_token, token)).limit(1)
  return user ?? null
}

export async function getShopIds(userId: string, shopId?: string | null): Promise<string[]> {
  const conditions = [eq(shops.user_id, userId), or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO'))]
  if (shopId) conditions.push(eq(shops.id, shopId))
  const rows = await db.select({ id: shops.id }).from(shops).where(and(...conditions))
  return rows.map(s => s.id)
}

export type Plan = 'free' | 'pro' | 'pro_plus'

export const PLAN_SHOP_LIMITS: Record<Plan, number> = {
  free:     1,
  pro:      3,
  pro_plus: 5,
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const [data] = await db.select({
    plan: users.plan,
    plan_expires_at: users.plan_expires_at,
    trial_ends_at: users.trial_ends_at,
  }).from(users).where(eq(users.id, userId))

  const plan = (data?.plan ?? 'free') as Plan

  if (plan !== 'free' && data?.plan_expires_at) {
    if (new Date(data.plan_expires_at) < new Date()) return 'free'
  }

  if (plan === 'free') {
    if (!data?.trial_ends_at) {
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      await db.update(users).set({ trial_ends_at: trialEnd }).where(eq(users.id, userId))
      return 'pro'
    }
    if (new Date(data.trial_ends_at) > new Date()) {
      return 'pro'
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
  const [data] = await db.select({
    plan: users.plan,
    plan_expires_at: users.plan_expires_at,
    trial_ends_at: users.trial_ends_at,
  }).from(users).where(eq(users.id, userId))

  const plan = (data?.plan ?? 'free') as Plan
  const planExpiresAt = data?.plan_expires_at?.toISOString() ?? null
  const trialEndsAt = data?.trial_ends_at?.toISOString() ?? null

  let effectivePlan: Plan = plan

  if (plan !== 'free' && planExpiresAt) {
    if (new Date(planExpiresAt) < new Date()) effectivePlan = 'free'
  }

  let isOnTrial = false

  if (plan === 'free') {
    if (!trialEndsAt) {
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      await db.update(users).set({ trial_ends_at: trialEnd }).where(eq(users.id, userId))
      effectivePlan = 'pro'
      isOnTrial = true
      return { plan, effectivePlan, planExpiresAt, trialEndsAt: trialEnd.toISOString(), isOnTrial }
    }
    if (new Date(trialEndsAt) > new Date()) {
      effectivePlan = 'pro'
      isOnTrial = true
    }
  }

  return { plan, effectivePlan, planExpiresAt, trialEndsAt, isOnTrial }
}
