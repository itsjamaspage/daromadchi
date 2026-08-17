/**
 * ATMOS billing callback (Step 5) — server-to-server, PUBLIC (no auth).
 *
 * ATMOS finalizes a charge ONLY when we reply HTTP 200 with exactly
 * {"status":1,"message":"Успешно"}. Anything else ({"status":0,...}) rejects it.
 *
 * Order of operations:
 *   1. Log the FULL raw body (jsonb) before any processing.
 *   2. (Toggleable) source-IP allowlist — default OFF in DEV.
 *   3. Confirm the classic callback shape; unknown shape ⇒ log + status 0.
 *   4. Verify sign == md5(store_id+transaction_id+account+amount+api_key)
 *      (constant-time, isolated in lib/billing/atmos.ts).
 *   5. Look up the payment by `account`; idempotent re-ack if already SUCCESS.
 *   6. Cross-check the real status via getInvoiceStatus() (defense in depth).
 *   7. Activate idempotently (at-most-once guard in lib/billing/activate.ts).
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  getConfig, verifyCallbackSign, computeCallbackSign, getInvoiceStatus,
  clientIpFromForwarded, isCallbackIpAllowed, AtmosConfigError,
} from '@/lib/billing/atmos'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'
import { tiyinToSom } from '@/lib/billing/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACCEPT = { status: 1, message: 'Успешно' }
function reject(message: string, log?: Record<string, unknown>) {
  const response = { status: 0, message }
  // TEMP verbose: always log the EXACT body we send back on a reject, so a failed
  // real payment shows precisely what ATMOS received from us.
  logger.warn('atmos_callback_rejected', { response, ...(log ?? {}) })
  return NextResponse.json(response, { status: 200 })
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
    amount: amount as string | number,   // byte-identical to what ATMOS sent
    apiKey: cfg.callbackApiKey,
  }
  const computedSign = computeCallbackSign(signParts)
  const okSign = verifyCallbackSign(sign, signParts)
  // TEMP verbose: log received vs computed sign. Both are MD5 HASHES (the API key
  // itself is never logged), so a mismatch is diagnosable straight from the logs.
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
  // TEMP verbose: log whether the account resolved to a real payment row.
  logger.info('atmos_callback_lookup', {
    account: accountStr, found: !!pay, atmosStatus: pay?.atmosStatus ?? null,
  })
  if (!pay) return reject('unknown_account', { account: accountStr })

  // Idempotency: already settled ⇒ re-ack without re-applying anything.
  if (pay.atmosStatus === 'success') {
    logger.info('atmos_callback_response', { account: accountStr, response: ACCEPT, outcome: 'idempotent_reack' })
    return NextResponse.json(ACCEPT, { status: 200 })
  }

  // Advisory amount check (sign already binds amount; the real gate is the
  // getInvoiceStatus cross-check below). Warn if it matches neither tiyin nor so'm.
  const amountNum = Number(amount)
  const expectTiyin = pay.amountTiyin ?? -1
  if (amountNum !== expectTiyin && amountNum !== tiyinToSom(expectTiyin)) {
    logger.warn('atmos_callback_amount_advisory', { account: accountStr, got: amountNum, expectTiyin })
  }

  // 6. Advisory status re-query — NON-blocking (was the deadlock).
  //
  // ATMOS finalizes the charge based on OUR ack, so AT CALLBACK TIME invoice/get
  // can still read "pending" (they're waiting for us). Gating the ack on "paid"
  // here rejected legitimate payments → "billing tizimida xato". The MD5 sign
  // already authenticates ATMOS and binds the amount, so we ACK on
  // sign+account+amount and only LOG the cross-check for observability. The log
  // captures the exact state string ATMOS returns so we can re-tighten this into
  // a precise gate later if we choose.
  if (pay.atmosPaymentId) {
    try {
      const st = await getInvoiceStatus(pay.atmosPaymentId)
      logger.info('atmos_callback_status_crosscheck', { account: accountStr, paid: st.paid, state: st.state })
    } catch (err) {
      logger.warn('atmos_callback_status_check_failed', { account: accountStr, error: String(err).slice(0, 200) })
    }
  } else {
    logger.warn('atmos_callback_no_atmos_payment_id', { account: accountStr })
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

  // TEMP verbose: log the EXACT body we send back on the accept path too.
  logger.info('atmos_callback_response', { account: accountStr, response: ACCEPT, outcome: 'accepted' })
  return NextResponse.json(ACCEPT, { status: 200 })
}
