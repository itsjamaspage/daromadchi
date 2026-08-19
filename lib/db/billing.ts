import { eq, desc, inArray, and } from 'drizzle-orm'
import { db, users, payments, subscriptions } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'

export type PlanType = 'free' | 'pro' | 'pro_plus'

// Display-only saved-card summary. NEVER includes the token or full PAN.
export interface SavedCard {
  last4: string | null
  expiry: string | null
  holder: string | null
}

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
  // Saved card (display-only) + whether auto-renew is on. Null card ⇒ none bound.
  card: SavedCard | null
  autorenew: boolean
  /** Turnover-derived tier RECOMMENDATION (migration 074). null = not computed yet. */
  derivedTier: string | null
  /** The 30-day turnover the recommendation was derived from, in so'm. */
  derivedTurnoverSom: number | null
}

export async function getBilling(): Promise<BillingInfo> {
  const empty: BillingInfo = {
    plan: 'free', planExpiresAt: null, isOnTrial: false, trialEndsAt: null, payments: [],
    card: null, autorenew: false, derivedTier: null, derivedTurnoverSom: null,
  }

  const userId = await getCurrentUserId()
  if (!userId) return empty

  const [[userRow], paymentRows, subRows] = await Promise.all([
    db.select({
      plan: users.plan,
      plan_expires_at: users.plan_expires_at,
      trial_ends_at: users.trial_ends_at,
      derived_tier: users.derived_tier,
      derived_turnover_som: users.derived_turnover_som,
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
    // Most-recent subscription with a bound card — powers the "Your card" panel
    // and the auto-renew toggle. The token itself is never selected.
    db.select({
      cardLast4: subscriptions.card_last4,
      cardExpiry: subscriptions.card_expiry,
      cardHolder: subscriptions.card_holder,
      hasToken: subscriptions.card_token_encrypted,
      autorenew: subscriptions.autorenew,
    }).from(subscriptions)
      .where(and(eq(subscriptions.user_id, userId), inArray(subscriptions.status, ['active', 'past_due', 'pending'])))
      .orderBy(desc(subscriptions.updated_at))
      .limit(1),
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

  const sub = subRows[0]
  const card: SavedCard | null = sub?.hasToken
    ? { last4: sub.cardLast4 ?? null, expiry: sub.cardExpiry ?? null, holder: sub.cardHolder ?? null }
    : null
  const autorenew = !!sub?.autorenew

  // Recommendation only — it never affects what the seller may use. NULL stays
  // NULL: "not computed yet" must stay distinguishable from "computed, free".
  const derivedTier = userRow?.derived_tier ?? null
  const rawTurnover = userRow?.derived_turnover_som
  const derivedTurnoverSom = rawTurnover == null ? null : Number(rawTurnover)

  return {
    plan, planExpiresAt, isOnTrial, trialEndsAt, payments: paymentList, card, autorenew,
    derivedTier,
    derivedTurnoverSom: derivedTurnoverSom !== null && Number.isFinite(derivedTurnoverSom) ? derivedTurnoverSom : null,
  }
}
