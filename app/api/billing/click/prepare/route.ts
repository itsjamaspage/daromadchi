import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'
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

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, amount, status')
    .eq('id', merchant_trans_id)
    .maybeSingle()

  if (!payment) return NextResponse.json({ ...base, ...ClickError.NOT_FOUND })
  if (Math.abs(Number(amount) - payment.amount) > 1) return NextResponse.json({ ...base, ...ClickError.WRONG_AMOUNT })
  if (payment.status === 'paid') return NextResponse.json({ ...base, ...ClickError.ALREADY_PAID })

  await supabaseAdmin
    .from('payments')
    .update({ provider_transaction_id: click_trans_id, updated_at: new Date().toISOString() })
    .eq('id', merchant_trans_id)

  return NextResponse.json({ ...base, merchant_prepare_id: merchant_trans_id, error: 0, error_note: 'Success' })
})
