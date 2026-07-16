import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser, getUserFromBearerToken } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { checkChannelMember } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Accept Bearer token (extension) or session cookie (dashboard)
  const authHeader = req.headers.get('authorization')
  const user = authHeader
    ? await getUserFromBearerToken(authHeader)
    : await getCurrentUser()
  if (!user) {
    return NextResponse.json({ subscribed: false, reason: 'unauthorized' }, { headers: CORS })
  }

  const [settings] = await db.select({
    telegram_chat_id: userSettings.telegram_chat_id,
  }).from(userSettings)
    .where(eq(userSettings.user_id, user.id))

  if (!settings?.telegram_chat_id) {
    return NextResponse.json({ subscribed: false, reason: 'no_telegram' }, { headers: CORS })
  }

  const subscribed = await checkChannelMember(settings.telegram_chat_id)
  return NextResponse.json({ subscribed }, { headers: CORS })
})
