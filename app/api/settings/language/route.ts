import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { normalizeLang } from '@/lib/notif-i18n'

// Persists the user's UI language so scheduled Telegram notifications (sent by a
// cron job that cannot read the browser cookie) go out in the same language.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { lang?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const lang = normalizeLang(body.lang)

  await db.insert(userSettings).values({
    user_id:    user.id,
    notif_lang: lang,
    updated_at: new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: { notif_lang: lang, updated_at: new Date() },
  })

  return NextResponse.json({ ok: true })
})
