/**
 * Auto-renewal cron. ATMOS has no native recurring, so we charge the stored card
 * token for subscriptions about to expire.
 *
 * DISABLED by default — set BILLING_AUTORENEW_ENABLED=1 only after the direct flow
 * is validated in prod. BILLING_RENEW_DRY_RUN=1 logs what it WOULD charge without
 * charging. Activation/period extension is exactly-once via applyAtmosPaymentSuccess
 * (same guard the interactive flow and callback use); apply is never retried
 * blindly (double-charge risk) — a failure just marks past_due and retries next run,
 * downgrading to free after a grace period (the card token is kept).
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { and, eq, lt, isNotNull, inArray } from 'drizzle-orm'
import { db, payments, subscriptions, users } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { decrypt } from '@/lib/crypto'
import { chargeBoundCard } from '@/lib/billing/recurring'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'
import { planAmountTiyin, planPeriodMonths, tiyinToSom, type PlanKey, type Interval } from '@/lib/billing/plans'

export const runtime = 'nodejs'
export const maxDuration = 300

const RENEW_WINDOW_MS = 24 * 60 * 60 * 1000
const GRACE_MS = 3 * 24 * 60 * 60 * 1000

function envOn(v: string | undefined): boolean {
  return /^(1|true|on|yes)$/i.test(v?.trim() || '')
}

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!envOn(process.env.BILLING_AUTORENEW_ENABLED)) {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }
  const dryRun = envOn(process.env.BILLING_RENEW_DRY_RUN)

  const now = new Date()
  const dueBefore = new Date(now.getTime() + RENEW_WINDOW_MS)

  const due = await db.select({
    id: subscriptions.id, userId: subscriptions.user_id, plan: subscriptions.plan,
    interval: subscriptions.interval, periodEnd: subscriptions.current_period_end,
    tokenEnc: subscriptions.card_token_encrypted,
  }).from(subscriptions).where(and(
    inArray(subscriptions.status, ['active', 'past_due']),
    eq(subscriptions.autorenew, true),   // per-subscription toggle (billing page)
    isNotNull(subscriptions.card_token_encrypted),
    lt(subscriptions.current_period_end, dueBefore),
  ))

  let charged = 0, failed = 0, downgraded = 0, skipped = 0
  for (const s of due) {
    if (s.plan !== 'pro' && s.plan !== 'pro_plus') { skipped++; continue }
    const interval: Interval = s.interval === 'annual' ? 'annual' : 'monthly'
    const amountTiyin = planAmountTiyin(s.plan as PlanKey, interval)
    const periodMonths = planPeriodMonths(interval)

    if (dryRun) {
      logger.info('billing_renew_dryrun', { subscriptionId: s.id, plan: s.plan, amountTiyin })
      continue
    }

    // Fresh payment row (new account) per charge so the callback lookup + the
    // exactly-once guard work per attempt.
    const account = randomUUID()
    let paymentId: string
    try {
      const [p] = await db.insert(payments).values({
        id: account, user_id: s.userId, provider: 'atmos', plan: s.plan, period_months: periodMonths,
        amount: String(tiyinToSom(amountTiyin)), amount_tiyin: amountTiyin,
        status: 'pending', atmos_status: 'created', request_id: randomUUID(),
        account, subscription_id: s.id,
      }).returning({ id: payments.id })
      paymentId = p.id
    } catch (err) {
      logger.error('billing_renew_persist_failed', { subscriptionId: s.id, error: String(err).slice(0, 200) })
      failed++; continue
    }

    try {
      const token = decrypt(s.tokenEnc as string)
      const { transactionId } = await chargeBoundCard(account, amountTiyin, token)
      // Activates the payment + extends the subscription/user plan, anchored on the
      // existing expiry (applyAtmosPaymentSuccess bases the new period on the later
      // of now / current expiry).
      await applyAtmosPaymentSuccess({ paymentId, transactionId, source: 'return' })
      charged++
    } catch (err) {
      await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: now })
        .where(eq(payments.id, paymentId)).catch(() => {})
      const overdueMs = s.periodEnd ? now.getTime() - new Date(s.periodEnd).getTime() : 0
      await db.update(subscriptions).set({ status: 'past_due', updated_at: now }).where(eq(subscriptions.id, s.id))
      if (overdueMs > GRACE_MS && s.userId) {
        // Past grace — pull access, but KEEP the card token so a later run can recover.
        await db.update(users).set({ plan: 'free', updated_at: now }).where(eq(users.id, s.userId))
        downgraded++
      }
      failed++
      logger.warn('billing_renew_charge_failed', { subscriptionId: s.id, error: String(err).slice(0, 200) })
    }
  }

  logger.info('billing_renew_done', { dryRun, due: due.length, charged, failed, downgraded, skipped })
  return NextResponse.json({ ok: true, dryRun, due: due.length, charged, failed, downgraded, skipped })
})
