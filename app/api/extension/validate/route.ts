import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  const admin = createAdminClient()
  const { data: userRow } = await admin
    .from('users')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle()

  const plan = (userRow?.plan ?? 'free') as string
  const planExpiresAt = (userRow?.plan_expires_at as string) ?? null
  const isExpired = !!planExpiresAt && new Date(planExpiresAt) < new Date()

  return NextResponse.json({ ok: true, plan: isExpired ? 'free' : plan })
})
