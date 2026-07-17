import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users, userSettings } from '@/lib/db/schema'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const [row] = await db.select({
    extension_token: users.extension_token,
  }).from(users).where(eq(users.id, user.id))

  let token = row?.extension_token ?? null
  if (!token) {
    token = crypto.randomUUID() + crypto.randomBytes(16).toString('hex')
    await db.update(users).set({ extension_token: token }).where(eq(users.id, user.id))
  }

  const settings = await db.query.userSettings.findFirst({
    columns: { telegram_chat_id: true, telegram_username: true },
    where: eq(userSettings.user_id, user.id),
  })

  return NextResponse.json({
    ok: true,
    email: user.email,
    token,
    tg: {
      connected: !!settings?.telegram_chat_id,
      username: settings?.telegram_username ?? null,
    },
  })
})
