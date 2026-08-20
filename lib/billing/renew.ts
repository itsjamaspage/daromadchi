/**
 * One auto-renewal pass: find subscriptions about to expire, charge the card
 * they bound, extend the ones that paid.
 *
 * ── Why this is a module and not just the cron route ───────────────────────
 * This is the only code path in the product that moves money without a human
 * present. Real auto-charging is still blocked on ATMOS `unknown_account`, so
 * the flag that turns it on (BILLING_AUTORENEW_ENABLED) will one day be flipped
 * against live cards having never run for real. The only honest way to make
 * that a reviewed decision instead of a gamble is to be able to drive this loop
 * from a test — every skip, every fallback, every failure branch — against a
 * real database and a fake gateway. A route handler cannot be driven that way.
 *
 * The route is now auth + env flags + one call. The rules live here, and
 * lib/billing/renew.integration.test.ts is the harness that proves them.
 *
 * `charge` and `decryptToken` are injectable for exactly that reason and for no
 * other. Production passes neither, so the defaults below are what ships; a
 * test that swapped in a charger which "succeeds" differently from ATMOS would
 * be proving nothing, so the fake is only ever allowed to do what ATMOS can do:
 * return a transaction id, or throw.
 */

import 'server-only'
import { randomUUID } from 'crypto'
import { and, eq, lt, isNotNull, inArray } from 'drizzle-orm'
import { db, payments, subscriptions, users } from '@/lib/db'
import { logger } from '@/lib/logger'
import { decrypt } from '@/lib/crypto'
import { chargeBoundCard } from '@/lib/billing/recurring'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'
import { renewalAmountTiyin, pendingAmountIsChargeable, promotePendingAmount } from '@/lib/billing/price-notice'
import { planPeriodMonths, tiyinToSom, isPlanKey, type Interval } from '@/lib/billing/plans'

/** How far ahead of expiry a subscription becomes due for renewal. */
export const RENEW_WINDOW_MS = 24 * 60 * 60 * 1000
/** How long a failing subscription keeps access before dropping to free. */
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000

/** Charges a bound card. Same shape as chargeBoundCard — the real one, by default. */
export type ChargeFn = (
  account: string,
  amountTiyin: number,
  cardToken: string,
  onCreated?: (transactionId: string) => Promise<void> | void,
) => Promise<{ transactionId: string }>

export interface RenewalOptions {
  /** Instant the pass runs at. Defaults to real now; injected only by the harness. */
  now?: Date
  /** Report what WOULD be charged, charge nothing. */
  dryRun?: boolean
  charge?: ChargeFn
  decryptToken?: (encrypted: string) => string
}

export interface RenewalSummary {
  dryRun: boolean
  /** Subscriptions the due-window query returned. */
  due: number
  charged: number
  failed: number
  /** Charged past grace and dropped to free. Card token is kept. */
  downgraded: number
  /** Plan string checkout cannot sell — never charged. */
  skipped: number
  /** No amount the seller ever agreed to — never charged. */
  noAgreedAmount: number
}

export async function runBillingRenewal(opts: RenewalOptions = {}): Promise<RenewalSummary> {
  const now = opts.now ?? new Date()
  const dryRun = opts.dryRun ?? false
  const charge = opts.charge ?? chargeBoundCard
  const decryptToken = opts.decryptToken ?? decrypt
  const dueBefore = new Date(now.getTime() + RENEW_WINDOW_MS)

  const due = await db.select({
    id: subscriptions.id, userId: subscriptions.user_id, plan: subscriptions.plan,
    interval: subscriptions.interval, periodEnd: subscriptions.current_period_end,
    tokenEnc: subscriptions.card_token_encrypted,
    agreedAmountTiyin: subscriptions.agreed_amount_tiyin,
    pendingAmountTiyin: subscriptions.pending_amount_tiyin,
    pendingEffectiveDate: subscriptions.pending_effective_date,
    pendingNotifiedAt: subscriptions.pending_notified_at,
  }).from(subscriptions).where(and(
    // A cancelled subscription is NOT in here. Cancellation keeps access to the
    // end of the paid period and then stops — charging it again would bill
    // someone who explicitly told us not to.
    inArray(subscriptions.status, ['active', 'past_due']),
    eq(subscriptions.autorenew, true),   // per-subscription toggle (billing page)
    isNotNull(subscriptions.card_token_encrypted),
    lt(subscriptions.current_period_end, dueBefore),
  ))

  let charged = 0, failed = 0, downgraded = 0, skipped = 0, noAgreedAmount = 0
  for (const s of due) {
    // Every plan checkout can sell must also RENEW. Naming pro and pro_plus by
    // hand here meant a paying Biznes subscriber was silently never charged
    // again and dropped to free at period end.
    if (!isPlanKey(s.plan)) { skipped++; continue }
    const interval: Interval = s.interval === 'annual' ? 'annual' : 'monthly'
    // Charge WHAT THEY AGREED TO, never the live PLAN_PRICES_TIYIN. Deriving the
    // amount from config means any later price edit silently reprices existing
    // subscribers: a card charged 50 000 so'm during the pricing test would be
    // charged 250 000 here once the config was restored.
    //
    // No agreed amount ⇒ SKIP. We would rather miss a renewal (recoverable: the
    // seller can pay again) than charge a number nobody consented to
    // (unrecoverable: that is a refund and a complaint). Migration 072
    // backfills these from the last settled payment, so a row still NULL here is
    // one we genuinely have no authorised price for.
    // A staged price change is charged ONLY once the seller was told, long
    // enough ago, and the effective date has arrived — every other case falls
    // back to the amount they agreed to. An increase that was never delivered
    // does not become chargeable just because its date passed.
    const chargingNewPrice = pendingAmountIsChargeable({
      pending_amount_tiyin: s.pendingAmountTiyin,
      pending_effective_date: s.pendingEffectiveDate,
      pending_notified_at: s.pendingNotifiedAt,
    }, now)
    const amountTiyin = renewalAmountTiyin({
      agreed_amount_tiyin: s.agreedAmountTiyin,
      pending_amount_tiyin: s.pendingAmountTiyin,
      pending_effective_date: s.pendingEffectiveDate,
      pending_notified_at: s.pendingNotifiedAt,
    }, now)
    if (s.pendingAmountTiyin != null && !chargingNewPrice) {
      logger.info('billing_renew_pending_price_not_yet_due', {
        subscriptionId: s.id,
        effectiveDate: s.pendingEffectiveDate?.toISOString() ?? null,
        notified: s.pendingNotifiedAt !== null,
      })
    }
    if (amountTiyin == null || amountTiyin <= 0) {
      noAgreedAmount++
      logger.error('billing_renew_skipped_no_agreed_amount', {
        subscriptionId: s.id, userId: s.userId, plan: s.plan, interval,
      })
      continue
    }
    const periodMonths = planPeriodMonths(interval)

    if (dryRun) {
      logger.info('billing_renew_dryrun', { subscriptionId: s.id, plan: s.plan, amountTiyin, chargingNewPrice })
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
      const token = decryptToken(s.tokenEnc as string)
      const { transactionId } = await charge(account, amountTiyin, token,
        async (txnId) => {
          await db.update(payments).set({ atmos_payment_id: txnId, updated_at: now })
            .where(eq(payments.id, paymentId)).catch(() => {})
        })
      // Activates the payment + extends the subscription/user plan, anchored on the
      // existing expiry (applyAtmosPaymentSuccess bases the new period on the later
      // of now / current expiry).
      await applyAtmosPaymentSuccess({ paymentId, transactionId, source: 'return' })
      // Promote AFTER the charge succeeded. Moving the agreed price on the
      // strength of an attempt would leave a seller agreed to a number they
      // never actually paid; a failed charge keeps the old price and the notice
      // standing, and the next run tries again.
      if (chargingNewPrice) await promotePendingAmount(s.id, now)
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

  logger.info('billing_renew_done', { dryRun, due: due.length, charged, failed, downgraded, skipped, noAgreedAmount })
  return { dryRun, due: due.length, charged, failed, downgraded, skipped, noAgreedAmount }
}
