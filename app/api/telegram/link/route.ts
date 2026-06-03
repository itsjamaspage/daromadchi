import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { telegramConfigured, telegramDeepLink } from '@/lib/telegram'

// Generates a one-time deep link the user clicks to connect their Telegram account.
// Uses the browser session (cookie) rather than an Authorization header.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!telegramConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const linkToken = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id:                  user.id,
      telegram_link_token:      linkToken,
      telegram_link_expires_at: expiresAt.toISOString(),
      updated_at:               new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) return NextResponse.json({ error: 'token_failed' }, { status: 500 })

  return NextResponse.json({ url: telegramDeepLink(linkToken), expiresAt })
}
