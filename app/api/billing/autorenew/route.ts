/**
 * Toggle auto-renew for the signed-in user's subscription(s). When off, the
 * renewal cron skips them (the stored card token is kept, so it can be turned
 * back on without re-entering the card). Auth'd; no card data involved.
 */

import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }

  const enabled = body.enabled === true
  try {
    await db.update(subscriptions)
      .set({ autorenew: enabled, updated_at: new Date() })
      .where(and(
        eq(subscriptions.user_id, user.id),
        inArray(subscriptions.status, ['active', 'past_due', 'pending']),
      ))
    logger.info('billing_autorenew_set', { userId: user.id, enabled })
    return NextResponse.json({ ok: true, autorenew: enabled })
  } catch (err) {
    logger.error('billing_autorenew_failed', { userId: user.id, error: String(err).slice(0, 200) })
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
}
