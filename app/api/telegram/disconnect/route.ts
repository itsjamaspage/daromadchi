import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id:             user.id,
      telegram_chat_id:    null,
      telegram_username:   null,
      telegram_link_token: null,
      updated_at:          new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
