import { NextResponse } from 'next/server'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { assessFreshness } from '@/lib/health/freshness'

/**
 * Has the sync actually RUN recently?
 *
 * /api/health answers "is this process alive, and is it the build we deployed".
 * Both were true on 27 Aug while the sync cron had been dead for 40 minutes.
 * Liveness and work are different questions and need different endpoints.
 *
 * Unlike /api/health this one deliberately DOES touch the database, because the
 * database is where the evidence of work lives. That makes it capable of failing
 * for its own reasons — which is correct here: a watchdog that cannot reach the
 * DB should say so rather than report health it cannot observe.
 *
 * Secret-gated like the cron endpoints: it reports operational state, and the
 * public health endpoint stays the one that is safe to expose.
 *
 * 200 when fresh, 503 when stale — so a watchdog can act on the status code
 * alone without parsing the body.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // The shops that SHOULD be syncing: active, and holding a token to sync with.
  // A shop that is paused or has no credentials is not evidence of a fault.
  const [row] = await db.select({
    activeShops: sql<number>`count(*)`,
    newestStockSyncedAt: sql<Date | null>`max(${shops.stock_synced_at})`,
    newestHeavySyncAt: sql<Date | null>`max(${shops.last_synced_at})`,
  }).from(shops).where(and(
    eq(shops.is_active, true),
    isNotNull(shops.api_key_encrypted),
  ))

  const now = new Date()
  const result = assessFreshness({
    activeShops: Number(row?.activeShops ?? 0),
    newestStockSyncedAt: row?.newestStockSyncedAt ? new Date(row.newestStockSyncedAt) : null,
    now,
  })

  return NextResponse.json({
    ...result,
    activeShops: Number(row?.activeShops ?? 0),
    newestStockSyncedAt: row?.newestStockSyncedAt ?? null,
    // Detail only. last_synced_at advances on a HEAVY pass (6h free / 2h pro /
    // 30min pro_plus), so it is useful context and a terrible alert trigger.
    newestHeavySyncAt: row?.newestHeavySyncAt ?? null,
    checkedAt: now.toISOString(),
  }, { status: result.ok ? 200 : 503 })
})
