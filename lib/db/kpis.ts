import { unstable_cache } from 'next/cache'
import { inArray, sql } from 'drizzle-orm'
import { db, products } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import { computeStockGroups } from '@/lib/db/stock-groups'
import { fetchPeriodKpis } from '@/lib/db/kpis-period'
import type { Kpis, MarketplaceType } from '@/lib/types'
import { kpiWindows } from '@/lib/kpi-windows'

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

    // Both windows come from one tested helper — see lib/kpi-windows.ts. This was
    // inline date arithmetic that parsed 'YYYY-MM-DD' with `new Date(...)`, i.e.
    // as UTC midnight, so east of Greenwich the shown week began hours late and
    // the baseline it derived overlapped the week it was comparing against.
    const { since: sinceDate, until: untilDate, prevSince: prevSinceDate, prevUntil: prevUntilDate } =
      kpiWindows({ from, to, days })

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
      profit_cogs: current.cogs,
      profit_fees: current.fees,
      profit_revenue_counted: current.revenueCounted,
      missing_cost_products: current.missingCostProducts,
      cost_missing_revenue: current.costMissingRevenue,
      cost_missing_orders: current.costMissingOrders,
      counted_marketplaces: current.countedMarketplaces,
      pending_marketplaces: current.pendingMarketplaces,
      total_orders: current.orders,
      cancelled_orders: current.cancelled,
      cancelled_units: current.cancelledUnits,
      total_stock: totalStock,
    }

    if (prevSinceDate) {
      const prev = await fetchPeriodKpis(shopIds, prevSinceDate, prevUntilDate)
      result.change_revenue = pct(current.revenue, prev.revenue)
      result.change_profit = pct(current.profit, prev.profit)
      // The card SHOWS total − cancelled, so the badge beside it has to describe
      // that same number. It was comparing raw count(*), cancelled included —
      // which is how a week of 3 fulfilled orders and 5 cancellations came to
      // read "+300%" next to a card saying 3.
      result.change_orders = pct(current.orders - current.cancelled,
                                 prev.orders - prev.cancelled)
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
