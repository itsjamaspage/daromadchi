import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('telegram_chat_id, telegram_username')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    email: user.email,
    tg: {
      connected: !!settings?.telegram_chat_id,
      username: settings?.telegram_username ?? null,
    },
  })
}
