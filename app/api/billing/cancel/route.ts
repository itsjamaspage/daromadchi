/**
 * Cancel or resume the signed-in user's plan.
 *
 * Auth'd, no card data, no charge. Cancelling stops the next renewal and keeps
 * access to the end of the period already paid for — the money decisions all
 * live in lib/billing/cancel.ts; this is the door.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { cancelPlan, resumePlan } from '@/lib/billing/cancel'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  // Explicit action, no default: a cancel must never be something a malformed
  // request falls into.
  const action = body?.action

  if (action === 'resume') {
    const result = await resumePlan(user.id)
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  if (action !== 'cancel') {
    return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
  }

  const result = await cancelPlan(user.id)
  if (!result.ok) {
    logger.info('billing_cancel_nothing_to_cancel', { userId: user.id })
    return NextResponse.json({ ok: false, error: result.reason }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    accessUntil: result.state.accessUntil?.toISOString() ?? null,
  })
})
