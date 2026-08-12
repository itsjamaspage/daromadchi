/**
 * ATMOS billing callback (Phase 1).
 *
 * ATMOS calls this BEFORE finalizing a charge. It settles ONLY on HTTP 200 +
 * {"status":1,"message":"Успешно"}. We:
 *   1. accept only source IPs in ATMOS's range (92.63.207.0/24), read from
 *      X-Forwarded-For behind the reverse proxy;
 *   2. verify the `sign` HMAC over store_id+transaction_id+account+amount+api_key;
 *   3. match the payment by `account`, confirm the amount, mark it paid, activate
 *      the subscription + the user's plan, store the OFD receipt url;
 *   4. respond with the exact ack ATMOS requires.
 *
 * Idempotent: a repeat callback for an already-paid payment re-acks {status:1}
 * without re-applying anything.
 */

import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, payments, subscriptions, users } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getAtmosEnv, ATMOS_CALLBACK_AMOUNT_UNIT } from '@/lib/atmos/env'
import { verifySign } from '@/lib/atmos/sign'
import { ipInCidr, clientIpFromForwarded } from '@/lib/atmos/net'
import { tiyinToSom } from '@/lib/billing/plans'

export const runtime = 'nodejs'

const OK = { status: 1, message: 'Успешно' }
function reject(message: string, log?: Record<string, unknown>) {
  if (log) logger.warn('atmos_callback_rejected', { message, ...log })
  return NextResponse.json({ status: 0, message }, { status: 200 })
}

export async function POST(req: Request) {
  let env
  try {
    env = getAtmosEnv()
  } catch (err) {
    logger.error('atmos_callback_not_configured', { error: String(err).slice(0, 200) })
    return reject('not_configured')
  }

  // 1. Source-IP allowlist (reverse-proxy aware).
  const xff = req.headers.get('x-forwarded-for')
  const ip = clientIpFromForwarded(xff, req.headers.get('x-real-ip'))
  if (!ip || !ipInCidr(ip, env.callbackCidr)) {
    return reject('forbidden_ip', { ip })
  }

  // 2. Parse body.
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return reject('invalid_body')
  }
  const transactionId = String(body.transaction_id ?? body.transactionId ?? '')
  const account = String(body.account ?? '')
  const amountRaw = body.amount
  const sign = String(body.sign ?? '')
  if (!transactionId || !account || amountRaw == null || !sign) {
    return reject('missing_fields')
  }

  // 3. Verify sign using the amount FIELD VERBATIM (see lib/atmos/sign.ts).
  const okSign = verifySign(sign, {
    storeId: env.storeId,
    transactionId,
    account,
    amount: amountRaw as string | number,
    apiKey: env.callbackApiKey,
  })
  if (!okSign) return reject('bad_sign', { account, transactionId })

  // 4. Match the payment by account.
  const [pay] = await db.select({
    id: payments.id,
    userId: payments.user_id,
    plan: payments.plan,
    periodMonths: payments.period_months,
    amountTiyin: payments.amount_tiyin,
    status: payments.status,
    subscriptionId: payments.subscription_id,
  }).from(payments).where(eq(payments.account, account))
  if (!pay) return reject('unknown_account', { account })

  // Idempotency: already settled → re-ack without re-applying.
  if (pay.status === 'paid') return NextResponse.json(OK, { status: 200 })

  // 5. Confirm the amount against our authoritative tiyin. The comparison depends
  //    on ATMOS_CALLBACK_AMOUNT_UNIT:
  //      'tiyin'/'som' → STRICT equality (the real check, once the unit is known);
  //      'unknown'     → TEMPORARY non-blocking: accept tiyin OR so'm and WARN on
  //                      every callback so this is visibly a pending question, not
  //                      a silent accept. TODO(atmos): set the unit to close this.
  const amountNum = Number(amountRaw)
  const expectTiyin = pay.amountTiyin ?? -1
  const expectSom = tiyinToSom(expectTiyin)
  if (ATMOS_CALLBACK_AMOUNT_UNIT === 'tiyin') {
    if (amountNum !== expectTiyin) return reject('amount_mismatch', { account, got: amountNum, expectTiyin })
  } else if (ATMOS_CALLBACK_AMOUNT_UNIT === 'som') {
    if (amountNum !== expectSom) return reject('amount_mismatch', { account, got: amountNum, expectSom })
  } else {
    if (amountNum !== expectTiyin && amountNum !== expectSom) {
      return reject('amount_mismatch', { account, got: amountNum, expectTiyin })
    }
    logger.warn('atmos_callback_amount_unit_unknown', { account, got: amountNum, expectTiyin, expectSom })
  }

  // 6. Settle: mark paid, activate subscription + user plan, store OFD url.
  const ofdUrl = typeof body.ofd_url === 'string' ? body.ofd_url
    : typeof body.ofd_link === 'string' ? body.ofd_link : null
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + (pay.periodMonths ?? 1))

  try {
    await db.update(payments).set({
      status: 'paid',
      atmos_transaction_id: transactionId,
      ofd_url: ofdUrl,
      raw_callback: body,
      updated_at: now,
    }).where(eq(payments.id, pay.id))

    if (pay.subscriptionId) {
      await db.update(subscriptions).set({
        status: 'active', current_period_end: periodEnd, updated_at: now,
      }).where(eq(subscriptions.id, pay.subscriptionId))
    }

    if (pay.userId) {
      await db.update(users).set({
        plan: pay.plan as 'pro' | 'pro_plus', plan_expires_at: periodEnd,
      }).where(and(eq(users.id, pay.userId)))
    }
  } catch (err) {
    logger.error('atmos_callback_settle_failed', { account, error: String(err).slice(0, 300) })
    return reject('settle_failed', { account })
  }

  logger.info('atmos_callback_settled', { account, transactionId, plan: pay.plan })
  return NextResponse.json(OK, { status: 200 })
}
