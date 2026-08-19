/**
 * Bring a frozen account back. Auth'd, one click, nothing to confirm.
 *
 * Freezing removed nothing, so reactivating restores everything by clearing a
 * flag — there is no restore job, no window in which data is half-back.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { reactivate } from '@/lib/billing/lifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  await reactivate(user.id)
  return NextResponse.json({ ok: true })
})
