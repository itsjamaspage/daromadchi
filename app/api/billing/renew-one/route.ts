/**
 * POST /api/billing/renew-one
 *
 * Controlled single-subscription renewal — the safe test harness for proving
 * whether Atmos token charges work before flipping batch renewal to live.
 *
 * Owner-only. Requires an explicit subscription_id. Defaults to DRY-RUN.
 * Only performs a real charge when `confirm: true` is passed in the body.
 * There is no "renew all" fallback — this endpoint touches exactly one sub.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db, subscriptions, payments, renewalAttempts } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { decrypt } from '@/lib/crypto'
import { chargeBoundCard } from '@/lib/billing/recurring'
import { isPlanKey, tiyinToSom, planPeriodMonths, type Interval } from '@/lib/billing/plans'
import { renewalAmountTiyin, pendingAmountIsChargeable, promotePendingAmount } from '@/lib/billing/price-notice'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'
import { logger } from '@/lib/logger'

const OWNER_EMAILS: ReadonlySet<string> = new Set([
  'jkhakimjonov8@gmail.com',
])

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.email || !OWNER_EMAILS.has(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { subscription_id?: string; confirm?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const subId = body.subscription_id
  if (!subId || typeof subId !== 'string') {
    return NextResponse.json(
      { error: 'subscription_id is required (string UUID)' },
      { status: 400 },
    )
  }

  const dryRun = body.confirm !== true

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subId))

  if (!sub) {
    return NextResponse.json({ error: 'subscription not found' }, { status: 404 })
  }

  const issues: string[] = []
  if (!['active', 'past_due'].includes(sub.status)) {
    issues.push(`status is '${sub.status}' — must be active or past_due`)
  }
  if (!sub.card_token_encrypted) {
    issues.push('no card token bound')
  }
  if (!isPlanKey(sub.plan)) {
    issues.push(`plan '${sub.plan}' is not a recognized plan key`)
  }
  if (!sub.agreed_amount_tiyin || sub.agreed_amount_tiyin <= 0) {
    issues.push('no agreed_amount_tiyin — nothing to charge')
  }

  if (issues.length > 0 && !dryRun) {
    return NextResponse.json({
      error: 'subscription cannot be charged',
      issues,
      subscription: formatSub(sub),
    }, { status: 422 })
  }

  const now = new Date()
  const interval: Interval = sub.interval === 'annual' ? 'annual' : 'monthly'

  const chargingNewPrice = pendingAmountIsChargeable({
    pending_amount_tiyin: sub.pending_amount_tiyin,
    pending_effective_date: sub.pending_effective_date,
    pending_notified_at: sub.pending_notified_at,
  }, now)

  const amountTiyin = renewalAmountTiyin({
    agreed_amount_tiyin: sub.agreed_amount_tiyin,
    pending_amount_tiyin: sub.pending_amount_tiyin,
    pending_effective_date: sub.pending_effective_date,
    pending_notified_at: sub.pending_notified_at,
  }, now)

  if (issues.length > 0) {
    await logAttempt(sub.id, sub.user_id, sub.plan, interval, amountTiyin, dryRun, 'skipped_bad_plan', issues.join('; '))
    return NextResponse.json({
      dry_run: dryRun,
      outcome: 'skipped',
      issues,
      subscription: formatSub(sub),
    })
  }

  if (dryRun) {
    await logAttempt(sub.id, sub.user_id, sub.plan, interval, amountTiyin, true, 'dry_run')
    return NextResponse.json({
      dry_run: true,
      outcome: 'would_charge',
      subscription: formatSub(sub),
      charge: {
        amount_tiyin: amountTiyin,
        amount_som: amountTiyin ? amountTiyin / 100 : null,
        plan: sub.plan,
        interval,
        charging_new_price: chargingNewPrice,
        card_last4: sub.card_last4,
      },
    })
  }

  // ── Real charge (confirm=true) ──
  const account = randomUUID()
  let paymentId: string
  try {
    const [p] = await db.insert(payments).values({
      id: account, user_id: sub.user_id, provider: 'atmos', plan: sub.plan,
      period_months: planPeriodMonths(interval),
      amount: String(tiyinToSom(amountTiyin!)), amount_tiyin: amountTiyin!,
      status: 'pending', atmos_status: 'created', request_id: randomUUID(),
      account, subscription_id: sub.id,
    }).returning({ id: payments.id })
    paymentId = p.id
  } catch (err) {
    await logAttempt(sub.id, sub.user_id, sub.plan, interval, amountTiyin, false, 'failed', `payment persist: ${String(err).slice(0, 300)}`)
    return NextResponse.json({
      dry_run: false, outcome: 'failed', stage: 'payment_persist',
      error: String(err).slice(0, 300),
    }, { status: 500 })
  }

  try {
    const token = decrypt(sub.card_token_encrypted as string)
    const { transactionId } = await chargeBoundCard(account, amountTiyin!, token,
      async (txnId) => {
        await db.update(payments).set({ atmos_payment_id: txnId, updated_at: now })
          .where(eq(payments.id, paymentId)).catch(() => {})
      })

    await applyAtmosPaymentSuccess({ paymentId, transactionId, source: 'return' })
    if (chargingNewPrice) await promotePendingAmount(sub.id, now)

    await logAttempt(sub.id, sub.user_id, sub.plan, interval, amountTiyin, false, 'charged', undefined, paymentId, transactionId)

    logger.info('renew_one_charged', { subscriptionId: sub.id, transactionId, amountTiyin })

    return NextResponse.json({
      dry_run: false, outcome: 'charged',
      subscription_id: sub.id, payment_id: paymentId,
      atmos_transaction_id: transactionId,
      amount_tiyin: amountTiyin, plan: sub.plan, interval,
    })
  } catch (err) {
    await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: now })
      .where(eq(payments.id, paymentId)).catch(() => {})

    await logAttempt(sub.id, sub.user_id, sub.plan, interval, amountTiyin, false, 'failed', String(err).slice(0, 500), paymentId)

    logger.error('renew_one_failed', { subscriptionId: sub.id, error: String(err).slice(0, 300) })

    return NextResponse.json({
      dry_run: false, outcome: 'failed', stage: 'atmos_charge',
      subscription_id: sub.id, payment_id: paymentId,
      error: String(err).slice(0, 500),
    }, { status: 500 })
  }
}

async function logAttempt(
  subscriptionId: string, userId: string, plan: string,
  interval: string, amountTiyin: number | null, dryRun: boolean,
  outcome: string, error?: string, paymentId?: string, transactionId?: string,
) {
  await db.insert(renewalAttempts).values({
    subscription_id: subscriptionId, user_id: userId, payment_id: paymentId ?? null,
    plan, interval, amount_tiyin: amountTiyin, dry_run: dryRun,
    outcome, error: error ?? null, atmos_transaction_id: transactionId ?? null,
    source: 'manual',
  }).catch(() => {})
}

function formatSub(s: typeof subscriptions.$inferSelect) {
  return {
    id: s.id, user_id: s.user_id, plan: s.plan, interval: s.interval,
    status: s.status, period_end: s.current_period_end,
    autorenew: s.autorenew, has_card: !!s.card_token_encrypted,
    card_last4: s.card_last4, agreed_amount_tiyin: s.agreed_amount_tiyin,
  }
}
