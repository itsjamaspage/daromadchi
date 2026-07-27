import { NextResponse } from 'next/server'
import { desc, and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ lastSyncedAt: null }, { status: 401 })
  }

  const shopRows = await db.select({ last_synced_at: shops.last_synced_at })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.is_active, true)))
    .orderBy(desc(shops.last_synced_at))
    .limit(1)

  const lastSyncedAt = shopRows[0]?.last_synced_at?.toISOString() ?? null

  return NextResponse.json(
    { lastSyncedAt },
    { headers: { 'Cache-Control': 'private, max-age=10' } },
  )
})
