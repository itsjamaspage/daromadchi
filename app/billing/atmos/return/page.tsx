/**
 * ATMOS return page (Step 4) — where ATMOS redirects the browser after the
 * hosted checkout (ATMOS_SUCCESS_URL).
 *
 * We do NOT mark anything paid off this redirect. We look up the user's payment,
 * re-query the authoritative status via getInvoiceStatus(), and — only if ATMOS
 * confirms SUCCESS — activate idempotently through the same at-most-once guard
 * the callback uses. Then we show success / pending / failed.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { db, payments } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { getInvoiceStatus } from '@/lib/billing/atmos'
import { applyAtmosPaymentSuccess } from '@/lib/billing/activate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type View = 'success' | 'pending' | 'failed' | 'none'

export default async function AtmosReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const account = typeof sp.account === 'string' ? sp.account : undefined

  // The payment to reflect: the one named by ?account (scoped to this user), else
  // the user's most recent ATMOS payment.
  const where = account
    ? and(eq(payments.user_id, user.id), eq(payments.account, account))
    : eq(payments.user_id, user.id)
  const [pay] = await db.select({
    id: payments.id,
    atmosStatus: payments.atmos_status,
    atmosPaymentId: payments.atmos_payment_id,
    plan: payments.plan,
  }).from(payments)
    .where(and(where, eq(payments.provider, 'atmos')))
    .orderBy(desc(payments.created_at))
    .limit(1)

  let view: View = 'none'

  if (!pay) {
    view = 'none'
  } else if (pay.atmosStatus === 'success') {
    view = 'success'
  } else if (pay.atmosStatus === 'failed' || pay.atmosStatus === 'cancelled') {
    view = 'failed'
  } else if (pay.atmosPaymentId && (['created', 'pending'] as const).includes(pay.atmosStatus)) {
    // Re-query the authoritative status and settle idempotently on SUCCESS.
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

  const COPY: Record<View, { title: string; body: string; tone: string }> = {
    success: { title: 'To‘lov muvaffaqiyatli', body: 'Obunangiz faollashtirildi. Rahmat!', tone: 'text-emerald-400' },
    pending: { title: 'To‘lov qayta ishlanmoqda', body: 'To‘lovingiz tekshirilmoqda. Bu bir necha daqiqa vaqt olishi mumkin.', tone: 'text-amber-400' },
    failed:  { title: 'To‘lov amalga oshmadi', body: 'To‘lov yakunlanmadi. Iltimos, qaytadan urinib ko‘ring.', tone: 'text-red-400' },
    none:    { title: 'To‘lov topilmadi', body: 'Sizda kutilayotgan to‘lov mavjud emas.', tone: 'text-[var(--text-muted)]' },
  }
  const c = COPY[view]

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
