/**
 * Direct card-binding — step 2 (auth'd). Confirms the SMS OTP → reusable card
 * token, stores it ENCRYPTED (+ display-only masked last-4 / holder), then charges
 * the first period on the bound card and activates the subscription.
 *
 * The token is encrypted at rest (lib/crypto) and NEVER logged. Activation is
 * exactly-once via applyAtmosPaymentSuccess — the server-to-server callback may
 * settle the same payment in parallel; the DB guard makes that safe.
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { encrypt } from '@/lib/crypto'
import { bindCardConfirm, AtmosApiError } from '@/lib/billing/atmos'
import { chargeBoundCard } from '@/lib/billing/recurring'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function last4(pan: string | null): string | null {
  const d = String(pan ?? '').replace(/\D/g, '')
  return d.length >= 4 ? d.slice(-4) : null
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }

  const paymentId = String(body.paymentId ?? '')
  const bindTxnId = String(body.bindTxnId ?? '')
  const otp = String(body.otp ?? '')
  if (!paymentId || !bindTxnId || !/^\d{4,8}$/.test(otp)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 })
  }

  // Load + ownership-check the pending payment.
  const [pay] = await db.select({
    id: payments.id, userId: payments.user_id, amountTiyin: payments.amount_tiyin,
    account: payments.account, subscriptionId: payments.subscription_id, atmosStatus: payments.atmos_status,
  }).from(payments).where(eq(payments.id, paymentId))
  if (!pay || pay.userId !== user.id) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  if (pay.atmosStatus === 'success') return NextResponse.json({ ok: true, status: 'active' }) // idempotent

  // 1. Confirm the binding → reusable token (+ masked pan for display).
  let bind
  try {
    bind = await bindCardConfirm(bindTxnId, otp)
  } catch (err) {
    logger.warn('atmos_bindconfirm_failed', { paymentId, error: String(err).slice(0, 200) })
    const code = err instanceof AtmosApiError ? (err.code || 'confirm_failed') : 'confirm_failed'
    return NextResponse.json({ ok: false, error: code, stage: 'bind_confirm' }, { status: err instanceof AtmosApiError ? 400 : 502 })
  }

  // 2. Persist the ENCRYPTED token + display-only metadata (best-effort — the
  //    charge still proceeds even if this write hiccups; token is re-derivable
  //    only via a fresh bind, so we log but don't hard-fail here).
  if (pay.subscriptionId) {
    try {
      await db.update(subscriptions).set({
        card_token_encrypted: encrypt(bind.cardToken),
        card_id: bind.cardId ?? null,
        card_last4: last4(bind.panMasked),
        card_holder: bind.cardHolder ?? null,
        updated_at: new Date(),
      }).where(eq(subscriptions.id, pay.subscriptionId))
    } catch (err) {
      logger.error('atmos_token_store_failed', { paymentId, error: String(err).slice(0, 200) })
    }
  }

  // 3. Charge the bound card for the first period.
  let payTxnId: string
  try {
    const res = await chargeBoundCard(
      String(pay.account), Number(pay.amountTiyin ?? 0), bind.cardToken,
      // Persist the pay/create txn id before pay/apply so the parallel callback
      // resolves it cleanly (no atmos_callback_no_atmos_payment_id).
      async (txnId) => {
        await db.update(payments).set({ atmos_payment_id: txnId, updated_at: new Date() })
          .where(eq(payments.id, paymentId)).catch(() => {})
      },
    )
    payTxnId = res.transactionId
  } catch (err) {
    // The card IS bound (token stored) — surface cardBound so the UI offers "retry
    // payment" WITHOUT re-binding. Never auto-retry apply here (double-charge risk).
    await db.update(payments).set({ status: 'failed', atmos_status: 'failed', updated_at: new Date() })
      .where(eq(payments.id, paymentId)).catch(() => {})
    logger.warn('atmos_firstcharge_failed', { paymentId, error: String(err).slice(0, 200) })
    const code = err instanceof AtmosApiError ? (err.code || 'charge_failed') : 'charge_failed'
    return NextResponse.json({ ok: false, error: code, stage: 'charge', cardBound: true }, { status: err instanceof AtmosApiError ? 402 : 502 })
  }

  // 4. Activate (exactly-once; the callback may also settle this — idempotent).
  try {
    await applyAtmosPaymentSuccess({ paymentId: pay.id, transactionId: payTxnId, source: 'return' })
  } catch (err) {
    logger.error('atmos_direct_activate_failed', { paymentId, error: String(err).slice(0, 200) })
    return NextResponse.json({ ok: false, error: 'activate_failed' }, { status: 500 })
  }

  logger.info('atmos_direct_settled', { paymentId, transactionId: payTxnId })
  return NextResponse.json({ ok: true, status: 'active' })
}
