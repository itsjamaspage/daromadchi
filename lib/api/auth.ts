import { eq, ne, and, or, isNull, sql } from 'drizzle-orm'
import { db, shops, users } from '@/lib/db'
import { computeEffectivePlan, trialEndFrom } from '@/lib/billing/features'

export async function getExtensionUser(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token.length < 20) return null
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    plan: users.plan,
    plan_expires_at: users.plan_expires_at,
    trial_ends_at: users.trial_ends_at,
  }).from(users).where(sql`extension_token = ${token}`).limit(1)
  return user ?? null
}

export async function getShopIds(userId: string, shopId?: string | null): Promise<string[]> {
  const conditions = [eq(shops.user_id, userId), or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO'))]
  if (shopId) conditions.push(eq(shops.id, shopId))
  const rows = await db.select({ id: shops.id }).from(shops).where(and(...conditions))
  return rows.map(s => s.id)
}

export type Plan = 'free' | 'pro' | 'pro_plus' | 'biznes' | 'enterprise'

// PLAN_SHOP_LIMITS (free 1 / pro 3 / pro_plus 5) was removed here.
//
// It enforced nothing — no caller ever read it — while /pricing advertised
// "Unlimited do'konlar" on Pro, so the repository shipped a limit and its own
// contradiction side by side. It also contradicted the entitlement rules
// themselves: `marketplaces` is in FREE_FOREVER, meaning a free account is
// entitled to Uzum AND Yandex Market, which takes two shops. Capping free at one
// would have taken away a capability the free tier is promised.
//
// Store count is not a gated capability under the turnover model. Tiers differ
// by turnover and price; what a seller may USE is lib/billing/features.ts.

export async function getUserPlan(userId: string): Promise<Plan> {
  const [data] = await db.select({
    plan: users.plan,
    plan_expires_at: users.plan_expires_at,
    trial_ends_at: users.trial_ends_at,
  }).from(users).where(eq(users.id, userId))

  const plan = (data?.plan ?? 'free') as Plan

  // First sight of a free account with no trial recorded starts its trial. The
  // write is the ONLY side effect here; the decision itself lives in
  // computeEffectivePlan so cron jobs and diagnostics share one implementation.
  let trialEndsAt: Date | null = data?.trial_ends_at ?? null
  if (plan === 'free' && !trialEndsAt) {
    trialEndsAt = trialEndFrom(new Date())
    await db.update(users).set({ trial_ends_at: trialEndsAt }).where(eq(users.id, userId))
  }

  return computeEffectivePlan({
    plan,
    planExpiresAt: data?.plan_expires_at ?? null,
    trialEndsAt,
  }) as Plan
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
      const trialEnd = trialEndFrom(new Date())
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
