/**
 * ATMOS return page (Step 4) — where ATMOS redirects the browser after the
 * hosted checkout (ATMOS_SUCCESS_URL).
 *
 * We do NOT mark anything paid off this redirect. We look up the user’s payment,
 * re-query the authoritative status via getInvoiceStatus(), and — only if ATMOS
 * confirms SUCCESS — activate idempotently through the same at-most-once guard
 * the callback uses. Then we show success / pending / failed.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { getInvoiceStatus, getMpsTransactionStatus, mpsPreCreate, mpsCreateBind } from '@/lib/billing/atmos'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type View = 'success' | 'pending' | 'failed' | 'none' | 'threeds'

export default async function AtmosReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const account = typeof sp.account === 'string' ? sp.account : undefined

  const where = account
    ? and(eq(payments.user_id, user.id), eq(payments.account, account))
    : eq(payments.user_id, user.id)
  const [pay] = await db.select({
    id: payments.id,
    account: payments.account,
    atmosStatus: payments.atmos_status,
    atmosPaymentId: payments.atmos_payment_id,
    amountTiyin: payments.amount_tiyin,
    subscriptionId: payments.subscription_id,
    plan: payments.plan,
    rawCallback: payments.raw_callback,
  }).from(payments)
    .where(and(where, eq(payments.provider, 'atmos')))
    .orderBy(desc(payments.created_at))
    .limit(1)

  let view: View = 'none'
  let threeDsUrl: string | null = null

  if (!pay) {
    view = 'none'
  } else if (pay.atmosStatus === 'success') {
    view = 'success'
  } else if (pay.atmosStatus === 'failed' || pay.atmosStatus === 'cancelled') {
    view = 'failed'
  } else if (pay.atmosStatus === 'pending' || pay.atmosStatus === 'created') {
    const cb = pay.rawCallback as Record<string, unknown> | null
    const redirectUri = typeof cb?._3dsRedirectUri === 'string' ? cb._3dsRedirectUri : null
    const mpsTransactionId = typeof cb?._3dsTransactionId === 'string' ? cb._3dsTransactionId : null

    if (redirectUri && !sp['3ds_done']) {
      view = 'threeds'
      threeDsUrl = redirectUri
    } else if (mpsTransactionId) {
      try {
        const st = await getMpsTransactionStatus(mpsTransactionId)
        logger.info('atmos_return_mps_status', { paymentId: pay.id, paid: st.paid, state: st.state })
        if (st.paid) {
          await applyAtmosPaymentSuccess({ paymentId: pay.id, transactionId: mpsTransactionId, rawPayload: st.raw, source: 'return' })
          view = 'success'
        } else {
          view = 'pending'
        }
      } catch (err) {
        logger.warn('atmos_return_mps_status_failed', { paymentId: pay.id, error: String(err).slice(0, 200) })
        view = 'pending'
      }
    } else {
      // No MPS charge recorded yet — check if the card was bound and retry.
      const chargeError = typeof cb?._chargeError === 'string' ? cb._chargeError : null
      let retried = false

      if (!chargeError && pay.subscriptionId && pay.amountTiyin) {
        const [sub] = await db.select({ card_id: subscriptions.card_id })
          .from(subscriptions).where(eq(subscriptions.id, pay.subscriptionId)).limit(1)

        if (sub?.card_id) {
          logger.info('atmos_return_charge_retry', { paymentId: pay.id, cardId: sub.card_id })
          try {
            const pre = await mpsPreCreate({ amountTiyin: pay.amountTiyin, extId: pay.id, account: String(pay.account) })
            await db.update(payments).set({ atmos_payment_id: pre.transactionId, updated_at: new Date() })
              .where(eq(payments.id, pay.id)).catch(() => {})

            const charge = await mpsCreateBind({
              cardId: sub.card_id, amountTiyin: pay.amountTiyin, transactionId: pre.transactionId,
            })

            if (charge.threeDsRedirect) {
              await db.update(payments).set({
                atmos_status: 'pending', updated_at: new Date(),
                raw_callback: {
                  ...(cb ?? {}),
                  _3dsRedirectUri: charge.threeDsRedirect.redirectUri,
                  _3dsMpsExtId: charge.threeDsRedirect.mpsExtId,
                  _3dsTransactionId: charge.transactionId,
                  _3dsRequiredAt: new Date().toISOString(),
                  _chargeRetrySource: 'return',
                },
              }).where(eq(payments.id, pay.id)).catch(() => {})
              view = 'threeds'
              threeDsUrl = charge.threeDsRedirect.redirectUri
              retried = true
            } else {
              await applyAtmosPaymentSuccess({ paymentId: pay.id, transactionId: charge.transactionId, rawPayload: charge.raw, source: 'return' })
              view = 'success'
              retried = true
            }
          } catch (err) {
            const errStr = String(err).slice(0, 500)
            logger.error('atmos_return_charge_retry_failed', { paymentId: pay.id, error: errStr })
            await db.update(payments).set({
              raw_callback: { ...(cb ?? {}), _chargeError: errStr, _chargeFailedAt: new Date().toISOString(), _chargeRetrySource: 'return' },
              updated_at: new Date(),
            }).where(eq(payments.id, pay.id)).catch(() => {})
          }
        }
      }

      if (!retried) {
        if (pay.atmosPaymentId) {
          try {
            const st = await getInvoiceStatus(pay.atmosPaymentId)
            if (st.paid) {
              await applyAtmosPaymentSuccess({ paymentId: pay.id, rawPayload: st.raw, source: 'return' })
              view = 'success'
            } else {
              view = 'pending'
            }
          } catch (err) {
            logger.warn('atmos_return_status_check_failed', { paymentId: pay.id, error: String(err).slice(0, 200) })
            view = 'pending'
          }
        } else {
          view = 'pending'
        }
      }
    }
  } else {
    view = 'pending'
  }

  if (view === 'threeds' && threeDsUrl) {
    redirect(threeDsUrl)
  }

  const COPY: Record<Exclude<View, 'threeds'>, { title: string; body: string; tone: string }> = {
    success: { title: 'To‘lov muvaffaqiyatli', body: 'Obunangiz faollashtirildi. Rahmat!', tone: 'text-emerald-400' },
    pending: { title: 'To‘lov qayta ishlanmoqda', body: 'To‘lovingiz tekshirilmoqda. Bu bir necha daqiqa vaqt olishi mumkin.', tone: 'text-amber-400' },
    failed:  { title: 'To‘lov amalga oshmadi', body: 'To‘lov yakunlanmadi. Iltimos, qaytadan urinib ko‘ring.', tone: 'text-red-400' },
    none:    { title: 'To‘lov topilmadi', body: 'Sizda kutilayotgan to‘lov mavjud emas.', tone: 'text-[var(--text-muted)]' },
  }
  const c = COPY[view as Exclude<View, 'threeds'>]

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border2)] bg-[var(--bg-card2)] p-8 text-center shadow-2xl">
        <h1 className={`text-xl font-bold ${c.tone}`}>{c.title}</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">{c.body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/dashboard/billing" className="btn-primary text-sm font-semibold py-2.5 rounded-xl">
            Hisobga qaytish
          </Link>
          {view === 'pending' && (
            <Link href="/billing/atmos/return" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-base)]">
              Holatni yangilash
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
