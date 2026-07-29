import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, userSettings } from '@/lib/db'
import { getExtensionUser } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db.select({
    telegram_chat_id: userSettings.telegram_chat_id,
    telegram_username: userSettings.telegram_username,
  }).from(userSettings).where(eq(userSettings.user_id, user.id)).limit(1)

  return NextResponse.json({
    linked:   !!row?.telegram_chat_id,
    username: row?.telegram_username ?? null,
  })
})
