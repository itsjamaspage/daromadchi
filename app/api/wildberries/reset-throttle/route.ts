import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { clearWbThrottle } from '@/lib/wildberries/sync'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

// Manual escape hatch. Clears the WB rate-limit cooldown for every
// Wildberries shop the caller owns so the next sync attempt actually
// tries the API instead of skipping. Use this AFTER waiting the
// cooldown or regenerating the WB API token in the seller cabinet.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const wbShops = await db.select({ id: shops.id }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'wildberries')))

  for (const s of wbShops) clearWbThrottle(s.id)

  return NextResponse.json({ ok: true, cleared: wbShops.length })
})
