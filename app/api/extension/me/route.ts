import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const settings = await db.query.userSettings.findFirst({
    columns: { telegram_chat_id: true, telegram_username: true },
    where: eq(userSettings.user_id, user.id),
  })

  return NextResponse.json({
    ok: true,
    email: user.email,
    tg: {
      connected: !!settings?.telegram_chat_id,
      username: settings?.telegram_username ?? null,
    },
  })
})
