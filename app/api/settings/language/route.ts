import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { normalizeLang } from '@/lib/notif-i18n'

// Persists the user's UI language as the default notification language, but only
// when Telegram is not yet linked. Once the user picks a language in the
// Telegram bot, that choice is authoritative and the web UI language switcher
// must not overwrite it.
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

  const [existing] = await db.select({
    telegram_chat_id: userSettings.telegram_chat_id,
  }).from(userSettings).where(eq(userSettings.user_id, user.id))

  if (existing?.telegram_chat_id) {
    return NextResponse.json({ ok: true })
  }

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
