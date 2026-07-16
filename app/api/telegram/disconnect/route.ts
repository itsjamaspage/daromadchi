import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
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
