import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getUserFromBearerToken } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const authHeader = req.headers.get('authorization')
  const user = authHeader
    ? await getUserFromBearerToken(authHeader)
    : await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  const plan = (user.plan ?? 'free') as string
  const planExpiresAt = user.plan_expires_at ? new Date(user.plan_expires_at).toISOString() : null
  const isExpired = !!planExpiresAt && new Date(planExpiresAt) < new Date()

  return NextResponse.json({ ok: true, plan: isExpired ? 'free' : plan })
})
