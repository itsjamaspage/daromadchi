import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.insert(userSettings).values({
    user_id:             user.id,
    telegram_chat_id:    null,
    telegram_username:   null,
    telegram_link_token: null,
    updated_at:          new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      telegram_chat_id:    null,
      telegram_username:   null,
      telegram_link_token: null,
      updated_at:          new Date(),
    },
  })

  return NextResponse.json({ ok: true })
})
