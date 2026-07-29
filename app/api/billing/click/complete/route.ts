import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments, users } from '@/lib/db'
import { verifyClickSign, ClickError } from '@/lib/billing/click'
import { planExpiresAt } from '@/lib/billing/plans'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const text = await req.text()
  const body = Object.fromEntries(new URLSearchParams(text))

  const {
    click_trans_id,
    merchant_trans_id,
    merchant_prepare_id,
    amount,
    action,
    sign_time,
    sign_string,
    payment_status,
  } = body

  const base = { click_trans_id, merchant_trans_id }

  const valid = verifyClickSign({ clickTransId: click_trans_id, merchantTransId: merchant_trans_id, amount, action, signTime: sign_time, merchantPrepareId: merchant_prepare_id, incoming: sign_string })
  if (!valid) return NextResponse.json({ ...base, ...ClickError.SIGN_FAILED })

  const [payment] = await db.select({
    id: payments.id, user_id: payments.user_id, plan: payments.plan,
    period_months: payments.period_months, status: payments.status,
  }).from(payments).where(eq(payments.id, merchant_trans_id)).limit(1)

  if (!payment) return NextResponse.json({ ...base, ...ClickError.TRANS_NOT_FOUND })
  if (payment.status === 'paid') return NextResponse.json({ ...base, error: 0, error_note: 'Already paid' })

  if (Number(payment_status) < 0) {
    await db.update(payments).set({ status: 'cancelled', updated_at: new Date() }).where(eq(payments.id, payment.id))
    return NextResponse.json({ ...base, error: 0, error_note: 'Cancelled' })
  }

  await Promise.all([
    db.update(payments).set({ status: 'paid', updated_at: new Date() }).where(eq(payments.id, payment.id)),
    db.update(users).set({
      plan:            payment.plan,
      plan_expires_at: planExpiresAt(payment.period_months),
    }).where(eq(users.id, payment.user_id)),
  ])

  return NextResponse.json({ ...base, error: 0, error_note: 'Success' })
})
