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
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const linkToken = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  // Try insert first, fall back to update if row exists
  const { error: upsertError } = await supabaseAdmin.from('user_settings').upsert(
    {
      user_id:                  user.id,
      telegram_link_token:      linkToken,
      telegram_link_expires_at: expiresAt.toISOString(),
      updated_at:               new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (upsertError) {
    // Fallback: try a plain update in case upsert fails due to missing columns
    const { error: updateError } = await supabaseAdmin
      .from('user_settings')
      .update({
        telegram_link_token:      linkToken,
        telegram_link_expires_at: expiresAt.toISOString(),
        updated_at:               new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[telegram/link] upsert:', upsertError.message, '| update:', updateError.message)
      return NextResponse.json(
        { error: 'token_failed', detail: upsertError.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ url: telegramDeepLink(linkToken), expiresAt })
})
