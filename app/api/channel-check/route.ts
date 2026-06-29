import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin, getAuthUser } from '@/lib/api/auth'
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
  let userId: string | null = null
  const auth = req.headers.get('authorization')
  if (auth) {
    const user = await getAuthUser(auth)
    userId = user?.id ?? null
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ subscribed: false, reason: 'unauthorized' }, { headers: CORS })
  }

  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('telegram_chat_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!settings?.telegram_chat_id) {
    return NextResponse.json({ subscribed: false, reason: 'no_telegram' }, { headers: CORS })
  }

  const subscribed = await checkChannelMember(settings.telegram_chat_id)
  return NextResponse.json({ subscribed }, { headers: CORS })
})
