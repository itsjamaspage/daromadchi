import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db, payments } from '@/lib/db'
import { PLAN_PRICES, PLAN_MONTHS, type PlanKey, type Period } from '@/lib/billing/plans'
import { clickPaymentUrl } from '@/lib/billing/click'
import { paymePaymentUrl } from '@/lib/billing/payme'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
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

  const [payment] = await db.insert(payments).values({
    user_id: user.id,
    plan,
    amount: String(amount),
    status: 'pending',
  }).returning({ id: payments.id })

  if (!payment) {
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
  }

  void months

  const url = provider === 'click'
    ? clickPaymentUrl(payment.id, amount)
    : paymePaymentUrl(payment.id, amount)

  return NextResponse.json({ url, paymentId: payment.id })
})
