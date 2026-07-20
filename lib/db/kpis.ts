import { unstable_cache } from 'next/cache'
import { inArray, gte, lte, and, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import type { Kpis, MarketplaceType } from '@/lib/types'

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

const emptyKpis: Kpis = { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

async function fetchPeriodKpis(shopIds: string[], since: Date | null, until: Date | null) {
  // Orders KPI counts EVERY order received (a cancelled order still happened);
  // money figures exclude cancelled — a cancelled order earns nothing.
  const conditions = [
    inArray(orders.shop_id, shopIds),
  ]
  if (since) conditions.push(gte(orders.ordered_at, since))
  if (until) conditions.push(lte(orders.ordered_at, until))

  const [orderAgg] = await db.select({
    total_revenue: sql<number>`coalesce(sum(${orders.revenue}::numeric) filter (where ${orders.status} <> 'cancelled'), 0)`,
    total_profit: sql<number>`coalesce(sum(${orders.revenue}::numeric - coalesce(${orders.marketplace_fee}::numeric, 0) - coalesce(${orders.delivery_cost}::numeric, 0)) filter (where ${orders.status} <> 'cancelled'), 0)`,
    total_orders: sql<number>`count(*)`,
    cancelled_orders: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
  }).from(orders).where(and(...conditions))

  // Cancelled UNITS (a single cancelled order can hold several items — users
  // think in items, so the KPI note shows both counts).
  const [unitAgg] = await db.select({
    units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
  }).from(orderItems)
    .innerJoin(orders, eq(orderItems.order_id, orders.id))
    .where(and(...conditions, sql`${orders.status} = 'cancelled'`))

  return {
    revenue: Number(orderAgg?.total_revenue ?? 0),
    profit: Number(orderAgg?.total_profit ?? 0),
    orders: Number(orderAgg?.total_orders ?? 0),
    cancelled: Number(orderAgg?.cancelled_orders ?? 0),
    cancelledUnits: Number(unitAgg?.units ?? 0),
  }
}

const _fetchKpis = unstable_cache(
  async (shopIdsStr: string, days: number, from: string, to: string): Promise<Kpis> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return emptyKpis

    let sinceDate: Date | null = null
    let untilDate: Date | null = null
    let prevSinceDate: Date | null = null
    let prevUntilDate: Date | null = null

    if (from && to) {
      sinceDate = new Date(from)
      untilDate = new Date(to); untilDate.setHours(23, 59, 59, 999)
      const spanMs = untilDate.getTime() - sinceDate.getTime()
      prevUntilDate = new Date(sinceDate.getTime() - 1)
      prevSinceDate = new Date(prevUntilDate.getTime() - spanMs)
    } else if (days > 0) {
      sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - days + 1)
      prevSinceDate = new Date(sinceDate)
      prevSinceDate.setDate(prevSinceDate.getDate() - days)
      prevUntilDate = new Date(sinceDate)
    }

    const [current, stock] = await Promise.all([
      fetchPeriodKpis(shopIds, sinceDate, untilDate),
      db.select({
        total: sql<number>`coalesce(sum(${products.stock_quantity}), 0)`,
      }).from(products).where(inArray(products.shop_id, shopIds)),
    ])

    const result: Kpis = {
      total_revenue: current.revenue,
      total_profit: current.profit,
      total_orders: current.orders,
      cancelled_orders: current.cancelled,
      cancelled_units: current.cancelledUnits,
      total_stock: Number(stock[0]?.total ?? 0),
    }

    if (prevSinceDate) {
      const prev = await fetchPeriodKpis(shopIds, prevSinceDate, prevUntilDate)
      result.change_revenue = pct(current.revenue, prev.revenue)
      result.change_profit = pct(current.profit, prev.profit)
      result.change_orders = pct(current.orders, prev.orders)
    }

    return result
  },
  ['kpis-v2'],
  { revalidate: 30, tags: ['product-data', 'order-data'] },
)

export async function getKpis(
  days = 0,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<Kpis> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return emptyKpis
  return _fetchKpis(shopIds.join(','), days, from ?? '', to ?? '')
}
