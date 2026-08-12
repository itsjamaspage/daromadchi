/**
 * ATMOS hosted-checkout initiation (Phase 1).
 *
 * Creates a pending subscription + a pending payment row (with a persisted
 * request_id idempotency key), then asks ATMOS for a hosted invoice and returns its payment
 * URL. NO card data passes through Daromadchi — the customer enters their card on
 * ATMOS's page. Recurring/binding is Phase 2.
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import {
  planAmountTiyin, planPeriodMonths, formatSomFromTiyin,
  tiyinToSom, type PlanKey, type Interval,
} from '@/lib/billing/plans'
import { getAccessToken, createInvoice } from '@/lib/atmos/client'
import { buildSubscriptionOfdItems } from '@/lib/atmos/ofd'
import { AtmosConfigError } from '@/lib/atmos/env'

export const runtime = 'nodejs'

function isPlanKey(v: unknown): v is PlanKey {
  return v === 'pro' || v === 'pro_plus'
}
function isInterval(v: unknown): v is Interval {
  return v === 'monthly' || v === 'annual'
}

// Defensive extraction of the checkout URL + ids from the ATMOS invoice response.
// TODO(atmos): pin these to the exact field names once confirmed against the docs.
function extractInvoice(resp: Record<string, unknown>): { url?: string; token?: string; transactionId?: string } {
  const invoice = (resp.invoice ?? resp.data ?? resp) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  return {
    url: str(invoice.checkout_url) ?? str(invoice.payment_url) ?? str(invoice.url) ?? str(resp.checkout_url),
    token: str(invoice.token) ?? str(invoice.invoice_token) ?? str(resp.token),
    transactionId: str(invoice.invoice_id) ?? str(invoice.transaction_id) ?? str(resp.transaction_id),
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

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

  const amountTiyin = planAmountTiyin(plan, interval)
  const periodMonths = planPeriodMonths(interval)
  const requestId = randomUUID()        // hosted-checkout idempotency key (create/get)
  const account = randomUUID()          // reconciliation key echoed back in the callback

  // Persist the intent BEFORE calling ATMOS so a retry/callback maps to this row.
  let subscriptionId: string
  let paymentId: string
  try {
    const [sub] = await db.insert(subscriptions).values({
      user_id: user.id, plan, interval, status: 'pending',
    }).returning({ id: subscriptions.id })
    subscriptionId = sub.id

    const [pay] = await db.insert(payments).values({
      user_id: user.id,
      payer_email: user.email ?? null,
      provider: 'atmos',
      plan,
      period_months: periodMonths,
      amount: String(tiyinToSom(amountTiyin)),   // so'm, for the existing tax record
      amount_tiyin: amountTiyin,                  // authoritative charged tiyin
      status: 'pending',
      request_id: requestId,
      account,
      subscription_id: subscriptionId,
    }).returning({ id: payments.id })
    paymentId = pay.id
  } catch (err) {
    logger.error('atmos_checkout_persist_failed', { userId: user.id, error: String(err).slice(0, 300) })
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://daromadchi.uz'
  const planLabel = `Daromadchi ${plan === 'pro_plus' ? 'Pro+' : 'Pro'} — ${formatSomFromTiyin(amountTiyin)} so'm`

  try {
    const token = await getAccessToken()
    const resp = await createInvoice({
      amountTiyin,
      requestId,
      account,
      successUrl: `${appUrl}/billing/success`,
      items: buildSubscriptionOfdItems(planLabel, amountTiyin),
    }, token)

    const { url, token: invoiceToken, transactionId } = extractInvoice(resp as Record<string, unknown>)

    await db.update(payments).set({
      atmos_invoice_token: invoiceToken ?? null,
      atmos_transaction_id: transactionId ?? null,
      raw_callback: null,
      updated_at: new Date(),
    }).where(eq(payments.id, paymentId))

    if (!url) {
      logger.error('atmos_checkout_no_url', { paymentId, resp: JSON.stringify(resp).slice(0, 500) })
      return NextResponse.json({ ok: false, error: 'no_checkout_url' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, url, paymentId })
  } catch (err) {
    if (err instanceof AtmosConfigError) {
      logger.error('atmos_not_configured', { error: err.message })
      return NextResponse.json({ ok: false, error: 'atmos_not_configured' }, { status: 503 })
    }
    logger.error('atmos_checkout_failed', { paymentId, error: String(err).slice(0, 300) })
    await db.update(payments).set({ status: 'failed', updated_at: new Date() }).where(eq(payments.id, paymentId)).catch(() => {})
    return NextResponse.json({ ok: false, error: 'checkout_failed' }, { status: 502 })
  }
}
