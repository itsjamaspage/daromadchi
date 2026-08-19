/**
 * ATMOS hosted-checkout initiation (Step 3).
 *
 * Auth'd. Derives the amount SERVER-SIDE from the selected plan (never trusts a
 * client amount), persists a pending payment + subscription (so a retry/callback
 * maps to one intent), asks ATMOS for a hosted invoice, stores the ATMOS
 * payment_id, and returns { url }. The browser then redirects to url, where the
 * customer enters their card on ATMOS's page — no PAN ever reaches this server.
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import {
  planAmountTiyin, planPeriodMonths, formatSomFromTiyin, PLAN_PRICES_TIYIN,
  tiyinToSom, type PlanKey, type Interval,
} from '@/lib/billing/plans'
import { createInvoice, AtmosConfigError } from '@/lib/billing/atmos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Derived from PLAN_PRICES_TIYIN so a tier added there is billable here without
// a second edit — the mismatch that kept Biznes unbuyable while it had a price.
function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PLAN_PRICES_TIYIN, v)
}
function isInterval(v: unknown): v is Interval { return v === 'monthly' || v === 'annual' }

function itemName(plan: PlanKey, interval: Interval): string {
  const name = plan === 'pro_plus' ? 'Pro+' : 'Pro'
  const period = interval === 'annual' ? '12 мес' : '1 мес'
  return `Daromadchi — подписка (${name}, ${period})`
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const plan = body.plan
  const interval = body.interval ?? 'monthly'
  if (!isPlanKey(plan)) return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 })
  if (!isInterval(interval)) return NextResponse.json({ ok: false, error: 'invalid_interval' }, { status: 400 })

  // Amount is derived HERE, from the tiyin source of truth — never from the client.
  const amountTiyin = planAmountTiyin(plan, interval)
  const periodMonths = planPeriodMonths(interval)
  const paymentId = randomUUID()   // our internal id; also the ATMOS `account`
  const requestId = randomUUID()   // create-call idempotency key

  // Persist the intent BEFORE calling ATMOS.
  let subscriptionId: string
  try {
    const [sub] = await db.insert(subscriptions).values({
      // Lock in what this seller agreed to pay. Renewals charge THIS, so a later
      // edit to PLAN_PRICES_TIYIN can never silently reprice them.
      user_id: user.id, plan, interval, status: 'pending', agreed_amount_tiyin: amountTiyin,
    }).returning({ id: subscriptions.id })
    subscriptionId = sub.id

    await db.insert(payments).values({
      id: paymentId,
      user_id: user.id,
      payer_email: user.email ?? null,
      provider: 'atmos',
      plan,
      period_months: periodMonths,
      amount: String(tiyinToSom(amountTiyin)),  // so'm — legacy tax/accounting figure
      amount_tiyin: amountTiyin,                // authoritative charged tiyin
      status: 'pending',
      atmos_status: 'created',
      request_id: requestId,
      account: paymentId,                       // account == our payment id
      subscription_id: subscriptionId,
    })
  } catch (err) {
    logger.error('atmos_create_persist_failed', { userId: user.id, error: String(err).slice(0, 300) })
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  try {
    const invoice = await createInvoice({
      requestId,
      account: paymentId,
      amountTiyin,
      itemName: itemName(plan, interval),
    })

    await db.update(payments).set({
      atmos_payment_id: invoice.paymentId,
      atmos_invoice_token: invoice.token ?? null,
      atmos_status: 'pending',   // invoice created, awaiting payment on ATMOS's page
      updated_at: new Date(),
    }).where(eq(payments.id, paymentId))

    logger.info('atmos_invoice_created', { paymentId, plan, interval, amountTiyin, som: formatSomFromTiyin(amountTiyin) })
    return NextResponse.json({ ok: true, url: invoice.url })
  } catch (err) {
    if (err instanceof AtmosConfigError) {
      logger.error('atmos_not_configured', { error: err.message })
      // roll the intent back to a clean failed state
      await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: new Date() })
        .where(eq(payments.id, paymentId)).catch(() => {})
      return NextResponse.json({ ok: false, error: 'atmos_not_configured' }, { status: 503 })
    }
    logger.error('atmos_create_failed', { paymentId, error: String(err).slice(0, 300) })
    await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: new Date() })
      .where(eq(payments.id, paymentId)).catch(() => {})
    return NextResponse.json({ ok: false, error: 'checkout_failed' }, { status: 502 })
  }
}
