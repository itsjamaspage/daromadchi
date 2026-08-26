import { unstable_cache } from 'next/cache'
import { inArray, sql } from 'drizzle-orm'
import { db, products } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import { computeStockGroups } from '@/lib/db/stock-groups'
import { fetchPeriodKpis } from '@/lib/db/kpis-period'
import type { Kpis, MarketplaceType } from '@/lib/types'

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

const emptyKpis: Kpis = { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

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
