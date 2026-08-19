/**
 * Direct card-binding — step 1 (auth'd). Validates the plan, derives the amount
 * SERVER-SIDE, persists a pending payment + subscription (our `account` id is
 * saved BEFORE any ATMOS call so the callback lookup resolves), then asks ATMOS to
 * start card binding — which sends an SMS OTP to the cardholder. Returns the bind
 * transaction id + our payment id for step 2 (bind-confirm).
 *
 * The card PAN passes through here TRANSIT-ONLY on its way to ATMOS — it is NEVER
 * stored and NEVER logged. Only display-safe metadata is persisted later.
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { planAmountTiyin, planPeriodMonths, tiyinToSom, PLAN_PRICES_TIYIN, type PlanKey, type Interval } from '@/lib/billing/plans'
import { bindCardInit, AtmosConfigError, AtmosApiError } from '@/lib/billing/atmos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Derived from PLAN_PRICES_TIYIN so a tier added there is billable here without
// a second edit — the mismatch that kept Biznes unbuyable while it had a price.
function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PLAN_PRICES_TIYIN, v)
}
function isInterval(v: unknown): v is Interval { return v === 'monthly' || v === 'annual' }

// "MM/YY" | "MMYY" | "MM/YYYY" → { atmos: "YYmm", display: "MM/YY" }. Null if bad.
function parseExpiry(raw: unknown): { atmos: string; display: string } | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 4) return null
  const mm = digits.slice(0, 2)
  const yy = digits.slice(-2)
  const m = Number(mm)
  if (m < 1 || m > 12) return null
  return { atmos: `${yy}${mm}`, display: `${mm}/${yy}` }
}

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

  const cardNumber = String(body.card_number ?? '').replace(/\s/g, '')
  const expiry = parseExpiry(body.expiry)
  if (!/^\d{16,19}$/.test(cardNumber)) return NextResponse.json({ ok: false, error: 'invalid_card' }, { status: 400 })
  if (!expiry) return NextResponse.json({ ok: false, error: 'invalid_expiry' }, { status: 400 })

  const amountTiyin = planAmountTiyin(plan, interval)
  const periodMonths = planPeriodMonths(interval)
  const paymentId = randomUUID()   // our internal id == the ATMOS `account`
  const requestId = randomUUID()

  // Persist the intent BEFORE calling ATMOS (account must exist for the callback).
  let subscriptionId: string
  try {
    const [sub] = await db.insert(subscriptions).values({
      // Lock in what this seller agreed to pay — see the note in atmos/create.
      user_id: user.id, plan, interval, status: 'pending', card_expiry: expiry.display,
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
    logger.error('atmos_bindinit_persist_failed', { userId: user.id, error: String(err).slice(0, 300) })
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  // Start binding — ATMOS sends the SMS OTP. Never log the PAN.
  try {
    const init = await bindCardInit(cardNumber, expiry.atmos)
    logger.info('atmos_bindinit_ok', { paymentId, plan, interval, amountTiyin })
    return NextResponse.json({ ok: true, paymentId, subscriptionId, bindTxnId: init.transactionId })
  } catch (err) {
    await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: new Date() })
      .where(eq(payments.id, paymentId)).catch(() => {})
    logger.error('atmos_bindinit_failed', { paymentId, error: String(err).slice(0, 300) })
    if (err instanceof AtmosConfigError) return NextResponse.json({ ok: false, error: 'atmos_not_configured' }, { status: 503 })
    const code = err instanceof AtmosApiError ? (err.code || 'bind_failed') : 'bind_failed'
    return NextResponse.json({ ok: false, error: code }, { status: 502 })
  }
}
