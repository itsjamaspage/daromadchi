import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { checkChannelMember } from '@/lib/telegram'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const telegramChatId = settings?.telegram_chat_id
  if (!telegramChatId) {
    return NextResponse.json({ subscribed: false, reason: 'no_telegram' })
  }

  const subscribed = await checkChannelMember(telegramChatId)
  return NextResponse.json({ subscribed })
}
