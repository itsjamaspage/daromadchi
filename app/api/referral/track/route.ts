import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    const { refCode, newUserId } = await req.json() as { refCode: string; newUserId: string }
    if (!refCode || !newUserId) return NextResponse.json({ ok: false })

    if (newUserId !== user.id) return NextResponse.json({ ok: false }, { status: 403 })

    const [settings] = await db.select({ user_id: userSettings.user_id })
      .from(userSettings)
      .where(eq(userSettings.referral_code, refCode))

    if (!settings) return NextResponse.json({ ok: false, error: 'Code not found' })

    if (settings.user_id === user.id) return NextResponse.json({ ok: false, error: 'Self-referral not allowed' })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
})
