import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { telegramConfigured, telegramDeepLink } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!telegramConfigured()) {
    return NextResponse.json({ error: 'Telegram bot sozlanmagan' }, { status: 503 })
  }

  const linkToken = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  const { error } = await supabaseAdmin.from('user_settings').upsert(
    {
      user_id:                  user.id,
      telegram_link_token:      linkToken,
      telegram_link_expires_at: expiresAt.toISOString(),
      updated_at:               new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[telegram-link] upsert error:', error)
    return NextResponse.json({ error: 'Token yaratishda xato' }, { status: 500 })
  }

  return NextResponse.json({ url: telegramDeepLink(linkToken), expiresAt })
})
