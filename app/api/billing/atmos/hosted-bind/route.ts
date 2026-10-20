/**
 * POST /api/billing/atmos/hosted-bind
 *
 * Starts the hosted card-binding flow for Visa / Mastercard cards.
 * Creates a pending subscription + payment, calls ATMOS's
 * /checkout/card-bind/create, and returns the redirect URL. The user enters
 * their card on ATMOS's page; ATMOS calls our callback with { api_key, card_id }.
 *
 * Auth'd — the logged-in user owns the subscription.
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { planAmountTiyin, planPeriodMonths, tiyinToSom, isPlanKey, type Interval } from '@/lib/billing/plans'
import { hostedBindCreate, AtmosConfigError, AtmosApiError } from '@/lib/billing/atmos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isInterval(v: unknown): v is Interval { return v === 'monthly' || v === 'annual' }

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }

  const plan = body.plan
  const interval = body.interval ?? 'monthly'
  if (!isPlanKey(plan)) return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 })
  if (!isInterval(interval)) return NextResponse.json({ ok: false, error: 'invalid_interval' }, { status: 400 })

  const amountTiyin = planAmountTiyin(plan, interval)
  const periodMonths = planPeriodMonths(interval)
  const paymentId = randomUUID()
  const requestId = randomUUID()

  // Persist the intent BEFORE calling ATMOS (account must exist for the callback).
  let subscriptionId: string
  try {
    const [sub] = await db.insert(subscriptions).values({
      user_id: user.id, plan, interval, status: 'pending',
      agreed_amount_tiyin: amountTiyin,
    }).returning({ id: subscriptions.id })
    subscriptionId = sub.id

    await db.insert(payments).values({
      id: paymentId, user_id: user.id, payer_email: user.email ?? null, provider: 'atmos',
      plan, period_months: periodMonths,
      amount: String(tiyinToSom(amountTiyin)), amount_tiyin: amountTiyin,
      status: 'pending', atmos_status: 'created', request_id: requestId,
      account: paymentId, subscription_id: subscriptionId,
    })
  } catch (err) {
    logger.error('atmos_hosted_bind_persist_failed', { userId: user.id, error: String(err).slice(0, 300) })
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  // Build the success URL with the account so the return page can look it up.
  const baseSuccessUrl = process.env.ATMOS_SUCCESS_URL || 'https://daromadchi.uz/billing/atmos/return'
  const successUrl = `${baseSuccessUrl}?account=${encodeURIComponent(paymentId)}`

  try {
    const result = await hostedBindCreate({ requestId, account: paymentId, successUrl })

    // Store the ATMOS payment_id so the callback / return page can cross-check.
    await db.update(payments).set({
      atmos_payment_id: result.paymentId, updated_at: new Date(),
    }).where(eq(payments.id, paymentId)).catch(() => {})

    logger.info('atmos_hosted_bind_created', { paymentId, subscriptionId, plan, interval })
    return NextResponse.json({
      ok: true,
      paymentId,
      subscriptionId,
      url: result.url,
    })
  } catch (err) {
    await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: new Date() })
      .where(eq(payments.id, paymentId)).catch(() => {})
    const errStr = String(err).slice(0, 500)
    logger.error('atmos_hosted_bind_failed', { paymentId, error: errStr })
    if (err instanceof AtmosConfigError) return NextResponse.json({ ok: false, error: 'atmos_not_configured' }, { status: 503 })
    const code = err instanceof AtmosApiError ? (err.code || 'bind_failed') : 'bind_failed'
    return NextResponse.json({ ok: false, error: code, debug: errStr }, { status: 502 })
  }
}
