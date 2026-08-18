/**
 * Idempotent payment settlement + subscription activation.
 *
 * The ONE place a payment becomes SUCCESS and a subscription/plan is activated.
 * Both the server-to-server callback and the user-facing return page call this;
 * it is safe to call any number of times for the same payment.
 *
 * At-most-once guarantee: the transition to SUCCESS is a single conditional
 * UPDATE gated on a NON-FINAL atmos_status, inside a DB transaction. The row lock
 * that UPDATE takes serializes concurrent callers; whoever flips the row (1 row
 * returned) is the sole winner and performs activation. Everyone else sees 0 rows
 * and no-ops. Activating a subscription twice is therefore impossible.
 */

import 'server-only'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import { db, payments, subscriptions, users } from '@/lib/db'

const FINAL_STATES = ['success', 'failed', 'cancelled'] as const

export interface ApplySuccessInput {
  /** Our internal payment id (payments.id == the ATMOS `account`). */
  paymentId: string
  /** Card transaction id from the callback, if available. */
  transactionId?: string | null
  /** Fiscal receipt URL, if provided. */
  ofdUrl?: string | null
  /** Raw callback/status payload to persist for audit. */
  rawPayload?: unknown
  /** Where the settlement originated (for logging only). */
  source: 'callback' | 'return'
}

export interface ApplySuccessResult {
  /** true iff THIS call performed the SUCCESS transition + activation. */
  applied: boolean
  outcome: 'activated' | 'already_final' | 'not_found'
}

export async function applyAtmosPaymentSuccess(input: ApplySuccessInput): Promise<ApplySuccessResult> {
  const now = new Date()

  return db.transaction(async (tx) => {
    // Atomic, at-most-once flip: only rows NOT already in a final state match.
    const flipped = await tx
      .update(payments)
      .set({
        atmos_status: 'success',
        status: 'paid', // keep the legacy display column in lockstep
        confirmed_at: now,
        updated_at: now,
        ...(input.transactionId ? { atmos_transaction_id: input.transactionId } : {}),
        ...(input.ofdUrl ? { ofd_url: input.ofdUrl } : {}),
        ...(input.rawPayload !== undefined ? { raw_callback: input.rawPayload as Record<string, unknown> } : {}),
      })
      .where(and(eq(payments.id, input.paymentId), notInArray(payments.atmos_status, [...FINAL_STATES])))
      .returning({
        id: payments.id,
        userId: payments.user_id,
        plan: payments.plan,
        periodMonths: payments.period_months,
        subscriptionId: payments.subscription_id,
        amountTiyin: payments.amount_tiyin,
      })

    if (flipped.length === 0) {
      const [exists] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.id, input.paymentId))
      return { applied: false, outcome: exists ? 'already_final' : 'not_found' }
    }

    const pay = flipped[0]

    // Extend from the later of now / current expiry (so a renewal adds time
    // rather than clobbering an unexpired plan).
    let base = now
    if (pay.userId) {
      const [u] = await tx.select({ exp: users.plan_expires_at }).from(users).where(eq(users.id, pay.userId))
      if (u?.exp && u.exp > now) base = u.exp
    }
    const periodEnd = new Date(base)
    periodEnd.setMonth(periodEnd.getMonth() + (pay.periodMonths ?? 1))

    if (pay.subscriptionId) {
      await tx.update(subscriptions)
        .set({
          status: 'active',
          current_period_end: periodEnd,
          updated_at: now,
          // Self-heal the agreed price for any subscription that reached
          // settlement without one (legacy rows, or a future checkout path that
          // forgets to set it). COALESCE so a RENEWAL never overwrites the
          // original agreed price with whatever this cycle happened to charge —
          // only a subscription that has none gets filled.
          agreed_amount_tiyin: sql`COALESCE(${subscriptions.agreed_amount_tiyin}, ${pay.amountTiyin ?? null})`,
        })
        .where(eq(subscriptions.id, pay.subscriptionId))
    }

    if (pay.userId && (pay.plan === 'pro' || pay.plan === 'pro_plus')) {
      await tx.update(users)
        .set({ plan: pay.plan, plan_expires_at: periodEnd, updated_at: now })
        .where(eq(users.id, pay.userId))
    }

    return { applied: true, outcome: 'activated' }
  })
}
