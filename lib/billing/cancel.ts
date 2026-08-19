/**
 * Cancelling a plan.
 *
 * What cancelling means here: STOP THE NEXT CHARGE, KEEP WHAT WAS PAID FOR.
 * The seller has already bought the current period, so access runs to its end
 * and then lapses to Free on its own. It is not a refund and not an immediate
 * cut-off, and the UI says so in those words before the button is pressed.
 *
 * The one thing this module must never do is touch users.plan or
 * users.plan_expires_at. Entitlement lives there, the daily expire-plans job
 * already drops a lapsed plan to free, and cancelling by moving the expiry would
 * take away a period the seller paid for. Everything here is subscription-side:
 * the renewal cron selects on status and autorenew, so clearing both is what
 * actually stops the money.
 */
import 'server-only'
import { and, eq, inArray, desc } from 'drizzle-orm'
import { db, subscriptions, users } from '@/lib/db'
import { logger } from '@/lib/logger'

/** Subscriptions a cancel or resume acts on — everything not already finished. */
const LIVE_STATUSES = ['active', 'past_due', 'pending'] as const

export interface CancellationState {
  /** True when the seller has cancelled and no further charge will be made. */
  cancelled: boolean
  /** When they cancelled. */
  cancelledAt: Date | null
  /**
   * The date access was promised until. NULL when nothing was ever paid for, so
   * "cancelled, access already over" and "cancelled before any paid period"
   * stay distinguishable.
   */
  accessUntil: Date | null
  /** True while that promised access is still running. */
  stillActive: boolean
}

const NONE: CancellationState = { cancelled: false, cancelledAt: null, accessUntil: null, stillActive: false }

function stateFrom(row: { cancelled_at: Date | null; access_until: Date | null } | undefined, now: Date): CancellationState {
  if (!row?.cancelled_at) return NONE
  return {
    cancelled: true,
    cancelledAt: row.cancelled_at,
    accessUntil: row.access_until,
    stillActive: row.access_until !== null && row.access_until > now,
  }
}

/** What the billing page shows: the most recent cancellation, if any. */
export async function getCancellationState(userId: string, now: Date = new Date()): Promise<CancellationState> {
  const [row] = await db.select({
    cancelled_at: subscriptions.cancelled_at,
    access_until: subscriptions.access_until,
  }).from(subscriptions)
    .where(and(eq(subscriptions.user_id, userId), eq(subscriptions.status, 'cancelled')))
    .orderBy(desc(subscriptions.cancelled_at))
    .limit(1)
  return stateFrom(row, now)
}

export type CancelOutcome =
  | { ok: true; state: CancellationState }
  | { ok: false; reason: 'nothing_to_cancel' }

/**
 * Cancel every live subscription this user has.
 *
 * All of them, not just one: the auto-renew toggle already works across the set,
 * and leaving a second subscription renewing after a seller pressed "cancel"
 * would charge them for something they believe they ended.
 *
 * access_until is the period end the subscription already knows about, falling
 * back to the account's plan expiry — that is the date entitlement will actually
 * honour, so promising anything else would be a promise the gate does not keep.
 */
export async function cancelPlan(userId: string, now: Date = new Date()): Promise<CancelOutcome> {
  return db.transaction(async (tx) => {
    const live = await tx.select({
      id: subscriptions.id,
      periodEnd: subscriptions.current_period_end,
    }).from(subscriptions)
      .where(and(eq(subscriptions.user_id, userId), inArray(subscriptions.status, [...LIVE_STATUSES])))

    if (live.length === 0) return { ok: false as const, reason: 'nothing_to_cancel' as const }

    const [account] = await tx.select({ expires: users.plan_expires_at })
      .from(users).where(eq(users.id, userId))

    let latest: Date | null = null
    for (const sub of live) {
      const accessUntil = sub.periodEnd ?? account?.expires ?? null
      if (accessUntil && (latest === null || accessUntil > latest)) latest = accessUntil

      await tx.update(subscriptions).set({
        status: 'cancelled',
        // Belt and braces: the renewal cron requires status IN (active, past_due)
        // AND autorenew, so either alone would stop it. Clearing both means a
        // future query that forgets one condition still cannot charge a
        // cancelled seller.
        autorenew: false,
        cancelled_at: now,
        access_until: accessUntil,
        updated_at: now,
      }).where(eq(subscriptions.id, sub.id))
    }

    logger.info('billing_plan_cancelled', {
      userId, subscriptions: live.length, accessUntil: latest?.toISOString() ?? null,
    })

    return {
      ok: true as const,
      state: {
        cancelled: true,
        cancelledAt: now,
        accessUntil: latest,
        stillActive: latest !== null && latest > now,
      },
    }
  })
}

export type ResumeOutcome =
  | { ok: true }
  | { ok: false; reason: 'nothing_to_resume' | 'period_over' }

/**
 * Undo a cancellation, while the paid period is still running.
 *
 * A cancel button with no way back turns one mis-click into a support ticket,
 * and the seller has already paid for the period they are inside — putting the
 * renewal back on is the same decision they made when they subscribed.
 *
 * Once access_until has passed there is nothing to resume: the plan lapsed, and
 * restarting it would mean charging a card without a fresh checkout. That case
 * returns 'period_over' and the UI sends them to the plan chooser instead.
 */
export async function resumePlan(userId: string, now: Date = new Date()): Promise<ResumeOutcome> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: subscriptions.id, accessUntil: subscriptions.access_until })
      .from(subscriptions)
      .where(and(eq(subscriptions.user_id, userId), eq(subscriptions.status, 'cancelled')))

    if (rows.length === 0) return { ok: false as const, reason: 'nothing_to_resume' as const }

    const revivable = rows.filter(r => r.accessUntil !== null && r.accessUntil > now)
    if (revivable.length === 0) return { ok: false as const, reason: 'period_over' as const }

    for (const r of revivable) {
      await tx.update(subscriptions).set({
        status: 'active',
        autorenew: true,
        cancelled_at: null,
        access_until: null,
        updated_at: now,
      }).where(eq(subscriptions.id, r.id))
    }

    logger.info('billing_plan_resumed', { userId, subscriptions: revivable.length })
    return { ok: true as const }
  })
}
