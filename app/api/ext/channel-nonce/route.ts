import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin, getAuthUser } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// POST: generate a nonce tied to the current user
export const POST = withErrorHandler(async (req: NextRequest) => {
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  // Delete expired nonces for this user first
  await supabaseAdmin
    .from('channel_nonces')
    .delete()
    .eq('user_id', userId)
    .lt('expires_at', new Date().toISOString())

  const nonce = Math.random().toString(36).slice(2, 8) +
                Math.random().toString(36).slice(2, 8)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min

  await supabaseAdmin.from('channel_nonces').upsert({
    nonce,
    user_id: userId,
    verified: false,
    expires_at: expiresAt,
  })

  return NextResponse.json({ nonce, expiresAt }, { headers: CORS })
})

// GET: check if a nonce has been verified by the bot
export const GET = withErrorHandler(async (req: NextRequest) => {
  const nonce = req.nextUrl.searchParams.get('nonce')
  if (!nonce) {
    return NextResponse.json({ verified: false }, { headers: CORS })
  }

  const { data } = await supabaseAdmin
    .from('channel_nonces')
    .select('verified, expires_at')
    .eq('nonce', nonce)
    .maybeSingle()

  if (!data) return NextResponse.json({ verified: false }, { headers: CORS })
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ verified: false, reason: 'expired' }, { headers: CORS })
  }

  // If verified, clean it up
  if (data.verified) {
    await supabaseAdmin.from('channel_nonces').delete().eq('nonce', nonce)
  }

  return NextResponse.json({ verified: data.verified }, { headers: CORS })
})
