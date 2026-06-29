import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    const { refCode, newUserId } = await req.json() as { refCode: string; newUserId: string }
    if (!refCode || !newUserId) return NextResponse.json({ ok: false })

    // Caller can only track their own referral
    if (newUserId !== user.id) return NextResponse.json({ ok: false }, { status: 403 })

    // Find the referrer by their code
    const { data: settings } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('referral_code', refCode)
      .single()

    if (!settings) return NextResponse.json({ ok: false, error: 'Code not found' })

    // Prevent self-referral
    if (settings.user_id === user.id) return NextResponse.json({ ok: false, error: 'Self-referral not allowed' })

    // Record the referral
    await supabase.from('referrals').insert({
      referrer_user_id: settings.user_id,
      referred_user_id: newUserId,
      code: refCode,
      status: 'pending',
      reward_amount: 0,
    })

    await supabase.from('user_settings').upsert({
      user_id: newUserId,
      referred_by: refCode,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
})
