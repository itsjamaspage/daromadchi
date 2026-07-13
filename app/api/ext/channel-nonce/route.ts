import { NextRequest, NextResponse } from 'next/server'
import { eq, and, lt } from 'drizzle-orm'
import { getCurrentUser, getUserFromBearerToken } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { channelNonces } from '@/lib/db/schema'
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
    const user = await getUserFromBearerToken(auth)
    userId = user?.id ?? null
  } else {
    const user = await getCurrentUser()
    userId = user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  // Delete expired nonces for this user first
  await db.delete(channelNonces)
    .where(and(
      eq(channelNonces.user_id, userId),
      lt(channelNonces.expires_at, new Date()),
    ))

  const nonce = Math.random().toString(36).slice(2, 8) +
                Math.random().toString(36).slice(2, 8)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

  await db.insert(channelNonces).values({
    nonce,
    user_id: userId,
    channel: 'telegram',
    used: false,
    expires_at: expiresAt,
  }).onConflictDoUpdate({
    target: channelNonces.nonce,
    set: {
      user_id: userId,
      used: false,
      expires_at: expiresAt,
    },
  })

  return NextResponse.json({ nonce, expiresAt: expiresAt.toISOString() }, { headers: CORS })
})

// GET: check if a nonce has been verified by the bot
export const GET = withErrorHandler(async (req: NextRequest) => {
  const nonce = req.nextUrl.searchParams.get('nonce')
  if (!nonce) {
    return NextResponse.json({ verified: false }, { headers: CORS })
  }

  const data = await db.query.channelNonces.findFirst({
    columns: { used: true, expires_at: true },
    where: eq(channelNonces.nonce, nonce),
  })

  if (!data) return NextResponse.json({ verified: false }, { headers: CORS })
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ verified: false, reason: 'expired' }, { headers: CORS })
  }

  // If verified (used), clean it up
  if (data.used) {
    await db.delete(channelNonces).where(eq(channelNonces.nonce, nonce))
  }

  return NextResponse.json({ verified: data.used }, { headers: CORS })
})
