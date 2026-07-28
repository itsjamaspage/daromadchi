import { NextResponse } from 'next/server'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { db, shops, users } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

// Kept in sync with app/api/cron/sync/route.ts — mirrored here so the diagnostic
// endpoint doesn't take a dependency on route module internals.
const SYNC_INTERVAL_MS: Record<string, number> = {
  free:     6 * 60 * 60 * 1000,
  pro:      2 * 60 * 60 * 1000,
  pro_plus: 30 * 60 * 1000,
}

function effectivePlan(u: { plan: string | null; plan_expires_at: Date | null; trial_ends_at: Date | null }): string {
  const plan = u.plan ?? 'free'
  if (plan !== 'free' && u.plan_expires_at && new Date(u.plan_expires_at) < new Date()) return 'free'
  if (plan === 'free' && u.trial_ends_at && new Date(u.trial_ends_at) > new Date()) return 'pro'
  return plan
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ${name}
      LIMIT 1
    `)
    return rows.rows.length > 0
  } catch {
    return false
  }
}

async function rowCount(table: string): Promise<number | null> {
  try {
    const rows = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${table}`))
    const row = rows.rows[0] as { n?: number } | undefined
    return row?.n ?? 0
  } catch {
    return null
  }
}

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const now = Date.now()

  const shopRows = await db.select({
    id: shops.id,
    user_id: shops.user_id,
    name: shops.name,
    marketplace: shops.marketplace,
    is_active: shops.is_active,
    last_synced_at: shops.last_synced_at,
    api_key_present: sql<boolean>`${shops.api_key_encrypted} IS NOT NULL`,
  }).from(shops).where(and(eq(shops.is_active, true), isNotNull(shops.api_key_encrypted)))

  const userIds = [...new Set(shopRows.map(s => s.user_id))]
  const userRows = userIds.length > 0
    ? await db.select({
        id: users.id,
        email: users.email,
        plan: users.plan,
        plan_expires_at: users.plan_expires_at,
        trial_ends_at: users.trial_ends_at,
      }).from(users)
    : []
  const userMap = new Map(userRows.map(u => [u.id, u]))

  const shopsOut = shopRows.map(s => {
    const u = userMap.get(s.user_id)
    const plan = u ? effectivePlan(u) : 'free'
    const interval = SYNC_INTERVAL_MS[plan] ?? SYNC_INTERVAL_MS.free
    const lastSync = s.last_synced_at ? new Date(s.last_synced_at).getTime() : null
    const eligible = lastSync == null || now - lastSync >= interval
    const nextEligibleAt = lastSync == null ? new Date(now).toISOString() : new Date(lastSync + interval).toISOString()
    return {
      shop_id: s.id,
      user_email: u?.email ?? null,
      name: s.name,
      marketplace: s.marketplace,
      plan,
      throttle_hours: interval / 3_600_000,
      last_synced_at: s.last_synced_at ? new Date(s.last_synced_at).toISOString() : null,
      minutes_since_last_sync: lastSync == null ? null : Math.round((now - lastSync) / 60_000),
      next_eligible_at: nextEligibleAt,
      minutes_until_next_eligible: Math.max(0, Math.round(((lastSync ?? now) + interval - now) / 60_000)),
      eligible_now: eligible,
    }
  })

  const migrations = {
    categories_canonical_exists: await tableExists('categories_canonical'),
    category_aliases_exists:     await tableExists('category_aliases'),
    categories_canonical_rows:   await rowCount('categories_canonical'),
    category_aliases_rows:       await rowCount('category_aliases'),
  }

  return NextResponse.json({
    ok: true,
    now: new Date(now).toISOString(),
    shops: shopsOut,
    migrations,
    hint: {
      run_seed:       'npm run seed:categories',
      manual_sync:    'curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/sync',
      verify_crontab: 'crontab -l | grep daromadchi',
    },
  })
})
