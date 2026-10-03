import { NextResponse } from 'next/server'
import { eq, desc, count, max } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, orders, products } from '@/lib/db'
import { pool } from '@/lib/db/drizzle'
import { withErrorHandler } from '@/lib/api-handler'
import { shopSyncLockHeld } from '@/lib/db/shop-lock'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Raw SQL to avoid crashing on columns that exist in the schema but whose
  // migration was never applied (products_synced_at, campaign_placement, etc.).
  const { rows: userShops } = await pool.query<{
    id: string
    name: string
    marketplace: string
    is_active: boolean
    last_synced_at: Date | null
    stock_synced_at: Date | null
    products_synced_at: Date | null
    campaign_placement: string | null
    token_valid: boolean | null
    throttled_until: Date | null
  }>(`
    select id, name, marketplace, is_active, last_synced_at,
           stock_synced_at,
           -- columns from migrations that may not be applied yet
           case when exists (
             select 1 from information_schema.columns
             where table_name = 'shops' and column_name = 'products_synced_at'
           ) then (select products_synced_at from shops s2 where s2.id = shops.id)
           end as products_synced_at,
           case when exists (
             select 1 from information_schema.columns
             where table_name = 'shops' and column_name = 'campaign_placement'
           ) then (select campaign_placement from shops s2 where s2.id = shops.id)
           end as campaign_placement,
           token_valid, throttled_until
    from shops
    where user_id = $1
  `, [user.id])

  const now = Date.now()
  const shopDetails = await Promise.all(userShops.map(async (s) => {
    const [orderStats] = await db.select({
      total: count(),
      latest: max(orders.ordered_at),
    }).from(orders).where(eq(orders.shop_id, s.id))

    const [productStats] = await db.select({
      total: count(),
    }).from(products).where(eq(products.shop_id, s.id))

    const recentOrders = await db.select({
      order_id_external: orders.order_id_external,
      status: orders.status,
      marketplace_status: orders.marketplace_status,
      revenue: orders.revenue,
      ordered_at: orders.ordered_at,
    }).from(orders)
      .where(eq(orders.shop_id, s.id))
      .orderBy(desc(orders.ordered_at))
      .limit(5)

    let lockHeld = false
    try { lockHeld = await shopSyncLockHeld(s.id) } catch { /* best-effort */ }

    const lastSyncAge = s.last_synced_at
      ? Math.round((now - new Date(s.last_synced_at).getTime()) / 1000)
      : null
    const stockSyncAge = s.stock_synced_at
      ? Math.round((now - new Date(s.stock_synced_at).getTime()) / 1000)
      : null

    // Check which shop columns are missing — these are why the cron sync crashes.
    const { rows: colRows } = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_name = 'shops' and column_name in ('products_synced_at', 'campaign_placement', 'stock_synced_at')`,
    )
    const existingCols = new Set(colRows.map(r => r.column_name))
    const missingCols = ['products_synced_at', 'campaign_placement', 'stock_synced_at']
      .filter(c => !existingCols.has(c))

    return {
      id: s.id,
      name: s.name,
      marketplace: s.marketplace,
      is_active: s.is_active,
      campaign_placement: s.campaign_placement,
      token_valid: s.token_valid,
      throttled_until: s.throttled_until?.toISOString?.() ?? (s.throttled_until ? String(s.throttled_until) : null),
      last_synced_at: s.last_synced_at?.toISOString?.() ?? (s.last_synced_at ? String(s.last_synced_at) : null),
      last_sync_age_seconds: lastSyncAge,
      stock_synced_at: s.stock_synced_at?.toISOString?.() ?? (s.stock_synced_at ? String(s.stock_synced_at) : null),
      stock_sync_age_seconds: stockSyncAge,
      products_synced_at: s.products_synced_at?.toISOString?.() ?? (s.products_synced_at ? String(s.products_synced_at) : null),
      sync_lock_held: lockHeld,
      missing_columns: missingCols.length > 0 ? missingCols : undefined,
      orders: {
        total: orderStats?.total ?? 0,
        latest_at: orderStats?.latest?.toISOString() ?? null,
      },
      products_count: productStats?.total ?? 0,
      recent_orders: recentOrders.map(o => ({
        ext_id: o.order_id_external,
        status: o.status,
        marketplace_status: o.marketplace_status,
        revenue: o.revenue ? Number(o.revenue) : null,
        ordered_at: o.ordered_at.toISOString(),
      })),
    }
  }))

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    shops: shopDetails,
  })
})
