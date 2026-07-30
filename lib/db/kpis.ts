import { unstable_cache } from 'next/cache'
import { inArray, gte, lte, and, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import { computeStockGroups } from '@/lib/db/stock-groups'
import { getRealFinancialsByBucket } from '@/lib/db/real-financials'
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

  // COGS aggregated in the same period so the Dashboard's Чистая
  // прибыль matches P&L / Payouts' "after everything" figure.
  const [orderAgg, cogsAgg, unitAgg] = await Promise.all([
    db.select({
      total_revenue: sql<number>`coalesce(sum(${orders.revenue}::numeric) filter (where ${orders.status} <> 'cancelled'), 0)`,
      // Estimate-only fallback: revenue − stored marketplace_fee − stored
      // delivery_cost. Overridden below with real settlement net when the
      // Yandex/Uzum settlement tables have any rows for this period.
      total_profit_estimate: sql<number>`coalesce(sum(${orders.revenue}::numeric - coalesce(${orders.marketplace_fee}::numeric, 0) - coalesce(${orders.delivery_cost}::numeric, 0)) filter (where ${orders.status} <> 'cancelled'), 0)`,
      total_orders: sql<number>`count(*)`,
      cancelled_orders: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
    }).from(orders).where(and(...conditions)),
    db.select({
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions, sql`${orders.status} <> 'cancelled'`)),
    // Cancelled UNITS (a single cancelled order can hold several items — users
    // think in items, so the KPI note shows both counts).
    db.select({
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(...conditions, sql`${orders.status} = 'cancelled'`)),
  ])

  // Sum real per-month settlement net across the period so "Чистая
  // прибыль" tracks what actually hits (or will hit) the seller's
  // balance, not the estimated marketplace_fee subtraction stored at
  // order-sync time. Fall back to the orders-table estimate when no
  // settlement rows exist for the period.
  const revenue = Number(orderAgg[0]?.total_revenue ?? 0)
  const cogs = Number(cogsAgg[0]?.cogs ?? 0)
  const fromDate = since ?? new Date(0)
  const realBuckets = await getRealFinancialsByBucket(shopIds, fromDate, 'month')
  let realNet = 0
  let hasAnyReal = false
  for (const b of realBuckets.values()) {
    if (b.itemCount > 0) { hasAnyReal = true; realNet += b.net }
  }
  const netFromMarketplace = hasAnyReal ? realNet : Number(orderAgg[0]?.total_profit_estimate ?? 0)
  // Dashboard "Чистая прибыль" = what the marketplace pays out minus what
  // the seller paid for the goods. Matches P&L "Чистая после расходов".
  const profit = netFromMarketplace - cogs

  return {
    revenue,
    profit,
    orders: Number(orderAgg[0]?.total_orders ?? 0),
    cancelled: Number(orderAgg[0]?.cancelled_orders ?? 0),
    cancelledUnits: Number(unitAgg[0]?.units ?? 0),
  }
}

const _fetchKpis = unstable_cache(
  async (userId: string, shopIdsStr: string, allShopIdsStr: string, marketplaceFiltered: boolean, days: number, from: string, to: string): Promise<Kpis> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return emptyKpis
    const allShopIds = allShopIdsStr ? allShopIdsStr.split(',') : shopIds

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

    // Stock: when viewing "All" marketplaces, compute the physically-correct
    // total using computeStockGroups (which handles FBS shared-pool + FBO
    // additive per member). When a specific marketplace is filtered in, a
    // naive per-shop SUM is fine because a shop can't have duplicate SKUs.
    const [current, stockNaive, groups] = await Promise.all([
      fetchPeriodKpis(shopIds, sinceDate, untilDate),
      marketplaceFiltered
        ? db.select({
            total: sql<number>`coalesce(sum(${products.stock_quantity}), 0)`,
          }).from(products).where(inArray(products.shop_id, shopIds))
        : Promise.resolve([{ total: 0 }]),
      marketplaceFiltered ? Promise.resolve([]) : computeStockGroups(userId, allShopIds),
    ])
    const totalStock = marketplaceFiltered
      ? Number(stockNaive[0]?.total ?? 0)
      : groups.reduce((sum, g) => sum + g.leftover, 0)

    const result: Kpis = {
      total_revenue: current.revenue,
      total_profit: current.profit,
      total_orders: current.orders,
      cancelled_orders: current.cancelled,
      cancelled_units: current.cancelledUnits,
      total_stock: totalStock,
    }

    if (prevSinceDate) {
      const prev = await fetchPeriodKpis(shopIds, prevSinceDate, prevUntilDate)
      result.change_revenue = pct(current.revenue, prev.revenue)
      result.change_profit = pct(current.profit, prev.profit)
      result.change_orders = pct(current.orders, prev.orders)
    }

    return result
  },
  ['kpis-v3'],
  { revalidate: 30, tags: ['product-data', 'order-data', 'settlements'] },
)

export async function getKpis(
  days = 0,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<Kpis> {
  const [userId, shopIds, allShopIds] = await Promise.all([
    getCurrentUserId(),
    getShopIds(marketplace),
    getShopIds(),
  ])
  if (!userId || !shopIds || shopIds.length === 0) return emptyKpis
  return _fetchKpis(
    userId,
    shopIds.join(','),
    (allShopIds ?? shopIds).join(','),
    !!marketplace,
    days,
    from ?? '',
    to ?? '',
  )
}
