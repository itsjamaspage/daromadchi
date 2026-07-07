import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db, userSettings } from '@/lib/db'
import { telegramConfigured, telegramDeepLink } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!telegramConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const linkToken = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await db.insert(userSettings).values({
    user_id:                  user.id,
    telegram_link_token:      linkToken,
    telegram_link_expires_at: expiresAt,
    updated_at:               new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      telegram_link_token:      linkToken,
      telegram_link_expires_at: expiresAt,
      updated_at:               new Date(),
    },
  })

  return NextResponse.json({ url: telegramDeepLink(linkToken), expiresAt })
})
