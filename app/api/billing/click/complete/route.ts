import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'
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

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, plan, period_months, status')
    .eq('id', merchant_trans_id)
    .maybeSingle()

  if (!payment) return NextResponse.json({ ...base, ...ClickError.TRANS_NOT_FOUND })
  if (payment.status === 'paid') return NextResponse.json({ ...base, error: 0, error_note: 'Already paid' })

  if (Number(payment_status) < 0) {
    await supabaseAdmin.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', payment.id)
    return NextResponse.json({ ...base, error: 0, error_note: 'Cancelled' })
  }

  await Promise.all([
    supabaseAdmin.from('payments').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', payment.id),
    supabaseAdmin.from('users').update({
      plan:            payment.plan,
      plan_expires_at: planExpiresAt(payment.period_months),
    }).eq('id', payment.user_id),
  ])

  return NextResponse.json({ ...base, error: 0, error_note: 'Success' })
})
