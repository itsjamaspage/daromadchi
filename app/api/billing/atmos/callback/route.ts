/**
 * ATMOS billing callback (Step 5) — server-to-server, PUBLIC (no auth).
 *
 * Handles TWO callback shapes:
 *
 * A) PAYMENT callback (charge settled):
 *    { store_id, transaction_id, transaction_time, amount, account, sign }
 *    ATMOS finalizes the charge ONLY when we reply HTTP 200 with exactly
 *    {"status":1,"message":"Успешно"}. Anything else rejects it.
 *
 * B) HOSTED BIND callback (card bound via Visa/MC flow):
 *    { api_key, card_id }
 *    ATMOS reports a successful card binding. We verify api_key matches our
 *    configured bind callback key, store the card_id on the subscription,
 *    and charge via MPS.
 *
 * Distinction: bind callbacks carry `api_key` + `card_id` without `sign`;
 * payment callbacks carry `sign` without `api_key`.
 */

import { NextResponse } from 'next/server'
import { eq, desc, and } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  getConfig, verifyCallbackSign, computeCallbackSign, getInvoiceStatus,
  clientIpFromForwarded, isCallbackIpAllowed, AtmosConfigError,
  getCardDetails, mpsPreCreate, mpsCreateBind,
} from '@/lib/billing/atmos'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'
import { tiyinToSom } from '@/lib/billing/plans'
import { createHash, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACCEPT = { status: 1, message: 'Успешно' }
function reject(message: string, log?: Record<string, unknown>) {
  const response = { status: 0, message }
  logger.warn('atmos_callback_rejected', { response, ...(log ?? {}) })
  return NextResponse.json(response, { status: 200 })
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch { return false }
}

export async function POST(req: Request) {
  // 1. Log the raw body FIRST, before any processing.
  const rawText = await req.text().catch(() => '')
  let body: Record<string, unknown> | null = null
  try {
    body = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null
  } catch {
    body = null
  }
  logger.info('atmos_callback_raw', { raw: body ?? rawText })

  // Config (needed for sign + cross-check). Missing config ⇒ cannot verify.
  let cfg
  try {
    cfg = getConfig()
  } catch (err) {
    logger.error('atmos_callback_not_configured', {
      error: err instanceof AtmosConfigError ? err.message : String(err).slice(0, 200),
    })
    return reject('not_configured')
  }

  // 2. Toggleable source-IP allowlist (default OFF in DEV).
  const ip = clientIpFromForwarded(req.headers.get('x-forwarded-for'), req.headers.get('x-real-ip'))
  if (!isCallbackIpAllowed(ip, cfg)) {
    return reject('forbidden_ip', { ip })
  }

  // ── Route: bind callback vs payment callback ──
  // Bind callbacks carry { api_key, card_id } (and may also include sign).
  const hasApiKey = typeof body?.api_key === 'string'
  const hasCardId = body?.card_id != null

  if (hasApiKey && hasCardId) {
    return handleBindCallback(body!, cfg)
  }

  // ── Classic payment callback ──
  return handlePaymentCallback(body, rawText, cfg)
}

// ── Hosted bind callback handler ──────────────────────────────────────────────

async function handleBindCallback(
  body: Record<string, unknown>,
  cfg: ReturnType<typeof getConfig>,
) {
  const apiKey = String(body.api_key ?? '')
  const cardId = String(body.card_id ?? '')
  const storeId = String(body.store_id ?? '')
  const account = String(body.account ?? '')
  const paymentId = String(body.payment_id ?? '')
  const sign = typeof body.sign === 'string' ? body.sign : ''

  logger.info('atmos_bind_callback', { cardId, account, hasApiKey: !!apiKey, hasSign: !!sign })

  // Verify sign: MD5(store_id + account + payment_id + card_id + api_key)
  if (sign) {
    const expected = createHash('md5')
      .update(`${storeId}${account}${paymentId}${cardId}${cfg.callbackApiKey}`)
      .digest('hex')
    if (!constantTimeEq(sign.toLowerCase(), expected.toLowerCase())) {
      logger.warn('atmos_bind_callback_bad_sign', { cardId, account })
      return reject('bad_sign')
    }
  } else if (cfg.bindCallbackApiKey) {
    if (!constantTimeEq(apiKey, cfg.bindCallbackApiKey)) {
      logger.warn('atmos_bind_callback_bad_key', { cardId })
      return reject('bad_api_key')
    }
  }

  // Look up the payment by account (== our internal payment id).
  const [pay] = account
    ? await db.select({
        id: payments.id,
        subscriptionId: payments.subscription_id,
      }).from(payments).where(eq(payments.account, account))
    : []

  // Find the subscription — either via the payment's subscription_id or fallback.
  const subWhere = pay?.subscriptionId
    ? eq(subscriptions.id, pay.subscriptionId)
    : eq(subscriptions.status, 'pending')

  const [sub] = await db.select({
    id: subscriptions.id,
    userId: subscriptions.user_id,
    plan: subscriptions.plan,
    interval: subscriptions.interval,
    status: subscriptions.status,
    card_id: subscriptions.card_id,
    agreed_amount_tiyin: subscriptions.agreed_amount_tiyin,
  }).from(subscriptions)
    .where(subWhere)
    .orderBy(desc(subscriptions.created_at))
    .limit(1)

  if (!sub) {
    logger.warn('atmos_bind_callback_no_pending_sub', { cardId, account })
    return reject('no_pending_subscription')
  }

  // Idempotency: if this subscription already has this card_id, re-ack.
  if (sub.card_id === cardId) {
    logger.info('atmos_bind_callback_idempotent', { subscriptionId: sub.id, cardId })
    return NextResponse.json(ACCEPT, { status: 200 })
  }

  // Store the card_id on the subscription immediately (no outbound calls).
  try {
    await db.update(subscriptions).set({
      card_id: cardId,
      updated_at: new Date(),
    }).where(eq(subscriptions.id, sub.id))
  } catch (err) {
    logger.error('atmos_bind_callback_store_failed', { subscriptionId: sub.id, error: String(err).slice(0, 200) })
    return reject('store_failed')
  }

  // Respond to ATMOS immediately — it has a short timeout.
  // The heavy work (card details, MPS charge, activation) runs after the
  // response is sent. The return page also re-queries and can pick up the
  // charge if this background work hasn't finished yet.
  logger.info('atmos_bind_callback_response', { subscriptionId: sub.id, cardId, outcome: 'accepted' })

  chargeAfterBind(sub, cardId, body).catch(err => {
    logger.error('atmos_bind_background_charge_failed', {
      subscriptionId: sub.id, cardId,
      error: String(err).slice(0, 300),
    })
  })

  return NextResponse.json(ACCEPT, { status: 200 })
}

async function chargeAfterBind(
  sub: { id: string; userId: string; plan: string; interval: string; agreed_amount_tiyin: number | null },
  cardId: string,
  rawBody: Record<string, unknown>,
) {
  // Fetch card details from ATMOS for display.
  try {
    const details = await getCardDetails(cardId)
    const last4 = details.panMasked ? details.panMasked.replace(/\D/g, '').slice(-4) || null : null
    await db.update(subscriptions).set({
      card_last4: last4,
      card_holder: details.cardType,
      updated_at: new Date(),
    }).where(eq(subscriptions.id, sub.id))
    logger.info('atmos_bind_bg_card_details', { cardId, cardType: details.cardType, last4 })
  } catch (err) {
    logger.warn('atmos_bind_bg_card_details_failed', { cardId, error: String(err).slice(0, 200) })
  }

  // Find the associated payment to charge via MPS.
  const [pay] = await db.select({
    id: payments.id,
    account: payments.account,
    amountTiyin: payments.amount_tiyin,
    atmosStatus: payments.atmos_status,
  }).from(payments)
    .where(eq(payments.subscription_id, sub.id))
    .orderBy(desc(payments.created_at))
    .limit(1)

  if (!pay || !pay.amountTiyin) {
    logger.info('atmos_bind_bg_no_payment', { subscriptionId: sub.id, cardId })
    return
  }

  if (pay.atmosStatus === 'success') {
    logger.info('atmos_bind_bg_already_settled', { paymentId: pay.id })
    return
  }

  // Charge via MPS (card_id-based charge for Visa/MC).
  try {
    const pre = await mpsPreCreate({
      amountTiyin: pay.amountTiyin,
      extId: pay.id,
      account: String(pay.account),
    })

    await db.update(payments).set({
      atmos_payment_id: pre.transactionId, updated_at: new Date(),
    }).where(eq(payments.id, pay.id)).catch(() => {})

    const charge = await mpsCreateBind({
      cardId,
      amountTiyin: pay.amountTiyin,
      transactionId: pre.transactionId,
    })

    await applyAtmosPaymentSuccess({
      paymentId: pay.id,
      transactionId: charge.transactionId,
      rawPayload: rawBody,
      source: 'callback',
    })

    logger.info('atmos_bind_bg_charged', {
      subscriptionId: sub.id, paymentId: pay.id,
      transactionId: charge.transactionId, cardId,
    })
  } catch (err) {
    logger.error('atmos_bind_bg_charge_failed', {
      subscriptionId: sub.id, paymentId: pay.id,
      error: String(err).slice(0, 300),
    })
    await db.update(payments).set({
      status: 'failed', atmos_status: 'failed', updated_at: new Date(),
    }).where(eq(payments.id, pay.id)).catch(() => {})
  }
}

// ── Classic payment callback handler ──────────────────────────────────────────

async function handlePaymentCallback(
  body: Record<string, unknown> | null,
  rawText: string,
  cfg: ReturnType<typeof getConfig>,
) {
  // 3. Confirm the classic callback shape. Unknown shape ⇒ do NOT guess.
  const storeId = body?.store_id
  const transactionId = body?.transaction_id
  const transactionTime = body?.transaction_time
  const amount = body?.amount
  const account = body?.account
  const sign = body?.sign
  const shapeOk =
    storeId != null && transactionId != null && transactionTime != null &&
    amount != null && account != null && typeof sign === 'string'
  if (!shapeOk) {
    logger.error('UNEXPECTED CALLBACK SHAPE', { raw: body ?? rawText })
    return reject('unexpected_shape')
  }

  const accountStr = String(account)
  const transactionIdStr = String(transactionId)

  // 4. Verify the signature (MD5, constant-time), using amount VERBATIM.
  const signParts = {
    storeId: String(storeId),
    transactionId: transactionIdStr,
    account: accountStr,
    amount: amount as string | number,
    apiKey: cfg.callbackApiKey,
  }
  const computedSign = computeCallbackSign(signParts)
  const okSign = verifyCallbackSign(sign, signParts)
  logger.info('atmos_callback_sign', {
    account: accountStr, transactionId: transactionIdStr,
    storeId: String(storeId), amount: String(amount),
    received: String(sign), computed: computedSign, match: okSign,
  })
  if (!okSign) return reject('bad_sign', { account: accountStr, transactionId: transactionIdStr })

  // 5. Look up the payment by account (== our internal payment id).
  const [pay] = await db.select({
    id: payments.id,
    atmosStatus: payments.atmos_status,
    atmosPaymentId: payments.atmos_payment_id,
    amountTiyin: payments.amount_tiyin,
  }).from(payments).where(eq(payments.account, accountStr))
  logger.info('atmos_callback_lookup', {
    account: accountStr, found: !!pay, atmosStatus: pay?.atmosStatus ?? null,
  })
  if (!pay) return reject('unknown_account', { account: accountStr })

  // Idempotency: already settled ⇒ re-ack without re-applying anything.
  if (pay.atmosStatus === 'success') {
    logger.info('atmos_callback_response', { account: accountStr, response: ACCEPT, outcome: 'idempotent_reack' })
    return NextResponse.json(ACCEPT, { status: 200 })
  }

  // Advisory amount check.
  const amountNum = Number(amount)
  const expectTiyin = pay.amountTiyin ?? -1
  if (amountNum !== expectTiyin && amountNum !== tiyinToSom(expectTiyin)) {
    logger.warn('atmos_callback_amount_advisory', { account: accountStr, got: amountNum, expectTiyin })
  }

  // 6. Advisory status re-query — NON-blocking.
  if (pay.atmosPaymentId) {
    try {
      const st = await getInvoiceStatus(pay.atmosPaymentId)
      logger.info('atmos_callback_status_crosscheck', { account: accountStr, paid: st.paid, state: st.state })
    } catch (err) {
      logger.warn('atmos_callback_status_check_failed', { account: accountStr, error: String(err).slice(0, 200) })
    }
  } else {
    logger.info('atmos_callback_no_atmos_payment_id_yet', { account: accountStr })
  }

  // 7. Activate idempotently (at-most-once guard).
  const ofdUrl = typeof body?.ofd_url === 'string' ? body.ofd_url
    : typeof body?.ofd_link === 'string' ? (body.ofd_link as string) : null
  try {
    const result = await applyAtmosPaymentSuccess({
      paymentId: pay.id,
      transactionId: transactionIdStr,
      ofdUrl,
      rawPayload: body,
      source: 'callback',
    })
    logger.info('atmos_callback_settled', { account: accountStr, transactionId: transactionIdStr, outcome: result.outcome })
  } catch (err) {
    logger.error('atmos_callback_settle_failed', { account: accountStr, error: String(err).slice(0, 300) })
    return reject('settle_failed', { account: accountStr })
  }

  logger.info('atmos_callback_response', { account: accountStr, response: ACCEPT, outcome: 'accepted' })
  return NextResponse.json(ACCEPT, { status: 200 })
}
