import { NextResponse } from 'next/server'
import { eq, and, desc, count, max } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, orders, products } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { shopSyncLockHeld } from '@/lib/db/shop-lock'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userShops = await db.select({
    id: shops.id,
    name: shops.name,
    marketplace: shops.marketplace,
    is_active: shops.is_active,
    last_synced_at: shops.last_synced_at,
    stock_synced_at: shops.stock_synced_at,
    products_synced_at: shops.products_synced_at,
    campaign_placement: shops.campaign_placement,
    token_valid: shops.token_valid,
    throttled_until: shops.throttled_until,
  })
    .from(shops)
    .where(eq(shops.user_id, user.id))

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

    return {
      id: s.id,
      name: s.name,
      marketplace: s.marketplace,
      is_active: s.is_active,
      campaign_placement: s.campaign_placement,
      token_valid: s.token_valid,
      throttled_until: s.throttled_until?.toISOString() ?? null,
      last_synced_at: s.last_synced_at?.toISOString() ?? null,
      last_sync_age_seconds: lastSyncAge,
      stock_synced_at: s.stock_synced_at?.toISOString() ?? null,
      stock_sync_age_seconds: stockSyncAge,
      products_synced_at: s.products_synced_at?.toISOString() ?? null,
      sync_lock_held: lockHeld,
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
