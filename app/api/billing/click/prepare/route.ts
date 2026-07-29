import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, payments } from '@/lib/db'
import { verifyClickSign, ClickError } from '@/lib/billing/click'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Click sends form-urlencoded
  const text = await req.text()
  const body = Object.fromEntries(new URLSearchParams(text))

  const {
    click_trans_id,
    merchant_trans_id,
    amount,
    action,
    sign_time,
    sign_string,
  } = body

  const base = { click_trans_id, merchant_trans_id }

  const valid = verifyClickSign({ clickTransId: click_trans_id, merchantTransId: merchant_trans_id, amount, action, signTime: sign_time, merchantPrepareId: null, incoming: sign_string })
  if (!valid) return NextResponse.json({ ...base, ...ClickError.SIGN_FAILED })

  const [payment] = await db.select({ id: payments.id, amount: payments.amount, status: payments.status })
    .from(payments).where(eq(payments.id, merchant_trans_id)).limit(1)

  if (!payment) return NextResponse.json({ ...base, ...ClickError.NOT_FOUND })
  if (Math.abs(Number(amount) - Number(payment.amount)) > 1) return NextResponse.json({ ...base, ...ClickError.WRONG_AMOUNT })
  if (payment.status === 'paid') return NextResponse.json({ ...base, ...ClickError.ALREADY_PAID })

  await db.update(payments)
    .set({ provider_transaction_id: click_trans_id, updated_at: new Date() })
    .where(eq(payments.id, merchant_trans_id))

  return NextResponse.json({ ...base, merchant_prepare_id: merchant_trans_id, error: 0, error_note: 'Success' })
})
