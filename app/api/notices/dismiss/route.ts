/**
 * Dismiss the in-app nudge banner.
 *
 * Auth'd. Dismissal is the seller saying "I have read this" — it does not
 * cancel the nudge, unsend the Telegram message, or change anything about their
 * plan. A recurring condition (turnover still above Free) legitimately brings
 * the banner back at the next sweep.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { dismissNotice } from '@/lib/billing/nudge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const kind = typeof body?.kind === 'string' ? body.kind : null
  if (!kind) return NextResponse.json({ ok: false, error: 'kind_required' }, { status: 400 })

  await dismissNotice(user.id, kind)
  return NextResponse.json({ ok: true })
})
