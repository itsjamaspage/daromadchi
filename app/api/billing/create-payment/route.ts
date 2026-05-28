import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { PLAN_PRICES, PLAN_MONTHS, type PlanKey, type Period } from '@/lib/billing/plans'
import { clickPaymentUrl } from '@/lib/billing/click'
import { paymePaymentUrl } from '@/lib/billing/payme'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { plan, period = 'monthly', provider } = body ?? {}

  if (!['pro', 'pro_plus'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!['click', 'payme'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const amount = PLAN_PRICES[plan as PlanKey][period as Period]
  const months = PLAN_MONTHS[period as Period]

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({ user_id: user.id, provider, amount, plan, period_months: months, status: 'pending' })
    .select('id')
    .single()

  if (error || !payment) {
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
  }

  const url = provider === 'click'
    ? clickPaymentUrl(payment.id, amount)
    : paymePaymentUrl(payment.id, amount)

  return NextResponse.json({ url, paymentId: payment.id })
}
