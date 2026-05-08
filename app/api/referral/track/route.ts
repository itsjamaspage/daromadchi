import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { refCode, newUserId } = await req.json() as { refCode: string; newUserId: string }
    if (!refCode || !newUserId) return NextResponse.json({ ok: false })

    const supabase = await createClient()

    // Find the referrer by their code
    const { data: settings } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('referral_code', refCode)
      .single()

    if (!settings) return NextResponse.json({ ok: false, error: 'Code not found' })

    // Record the referral
    await supabase.from('referrals').insert({
      referrer_user_id: settings.user_id,
      referred_user_id: newUserId,
      code: refCode,
      status: 'pending',
      reward_amount: 0,
    })

    // Store which code the new user used (for chaining)
    await supabase.from('user_settings').upsert({
      user_id: newUserId,
      referred_by: refCode,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
