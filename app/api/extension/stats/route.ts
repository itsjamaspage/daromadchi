import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray, gte, lt, lte, gt, desc, count, sql } from 'drizzle-orm'
import { db, orders, products, shops } from '@/lib/db'
import { getExtensionUser, getShopIds, getUserPlan } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shopIdParam = req.nextUrl.searchParams.get('shopId')
  const shopIds = await getShopIds(user.id, shopIdParam)

  if (shopIds.length === 0) {
    return NextResponse.json({
      todayRevenue: 0, todayProfit: 0, todayOrders: 0,
      todayCommission: 0, lowStock: 0, lastSynced: null,
      todayCancelled: 0, todayReturns: 0, marginPct: 0,
      revenueChange: null, ordersChange: null, returnRate: 0,
    })
  }

  const plan = await getUserPlan(user.id)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const since = new Date()
  if (plan === 'free') {
    since.setDate(since.getDate() - 7)
    since.setUTCHours(0, 0, 0, 0)
  } else {
    since.setUTCHours(0, 0, 0, 0)
  }

  const [todayRows, yesterdayRows, cancelledRow, returnedRow, inProcessRow, lowStockRow, shopRow] = await Promise.all([
    db.select({
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
      status: orders.status,
    }).from(orders).where(and(
      inArray(orders.shop_id, shopIds),
      gte(orders.ordered_at, since),
    )),
    db.select({
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
      status: orders.status,
    }).from(orders).where(and(
      inArray(orders.shop_id, shopIds),
      gte(orders.ordered_at, yesterday),
      lt(orders.ordered_at, today),
    )),
    db.select({ n: count() }).from(orders).where(and(
      inArray(orders.shop_id, shopIds),
      eq(orders.status, 'cancelled'),
    )),
    db.select({ n: count() }).from(orders).where(and(
      inArray(orders.shop_id, shopIds),
      eq(orders.status, 'returned'),
    )),
    db.select({ n: count() }).from(orders).where(and(
      inArray(orders.shop_id, shopIds),
      inArray(orders.status, ['pending', 'confirmed']),
    )),
    db.select({ n: count() }).from(products).where(and(
      inArray(products.shop_id, shopIds),
      lte(products.stock_quantity, 5),
      gt(products.stock_quantity, 0),
    )),
    db.select({ last_synced_at: shops.last_synced_at }).from(shops)
      .where(inArray(shops.id, shopIds))
      .orderBy(sql`${shops.last_synced_at} DESC NULLS LAST`)
      .limit(1),
  ])

  const activeToday      = todayRows.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const todayRevenue     = activeToday.reduce((s, o) => s + Number(o.revenue         ?? 0), 0)
  const todayCommission  = activeToday.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const todayDelivery    = activeToday.reduce((s, o) => s + Number(o.delivery_cost   ?? 0), 0)
  const todayProfit      = todayRevenue - todayCommission - todayDelivery
  const todayOrders      = activeToday.length
  const todayCancelled   = todayRows.filter(o => o.status === 'cancelled').length
  const todayReturned    = todayRows.filter(o => o.status === 'returned').length
  const marginPct        = todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 100) : 0

  const activeYesterday      = yesterdayRows.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const yesterdayRevenue     = activeYesterday.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
  const yesterdayOrderCount  = activeYesterday.length

  const revenueChange = yesterdayRevenue    > 0 ? Math.round(((todayRevenue - yesterdayRevenue)    / yesterdayRevenue)    * 100) : null
  const ordersChange  = yesterdayOrderCount > 0 ? Math.round(((todayOrders  - yesterdayOrderCount) / yesterdayOrderCount) * 100) : null

  const totalCancelled = Number(cancelledRow[0]?.n ?? 0)
  const totalReturned  = Number(returnedRow[0]?.n  ?? 0)
  const totalInProcess = Number(inProcessRow[0]?.n ?? 0)
  const totalOrders    = todayRows.length
  const returnRate     = totalOrders > 0 ? Math.round((totalReturned / totalOrders) * 100) : 0

  const lowStock   = Number(lowStockRow[0]?.n ?? 0)
  const lastSynced = shopRow[0]?.last_synced_at?.toISOString() ?? null

  return NextResponse.json({
    todayRevenue, todayProfit, todayOrders, todayCommission, lowStock, lastSynced,
    todayCancelled: todayCancelled + totalCancelled,
    todayReturns: todayReturned + totalReturned,
    inProcess: totalInProcess,
    marginPct, revenueChange, ordersChange, returnRate,
    plan,
    ...(plan === 'free' ? { historyDays: 7 } : {}),
  })
})
