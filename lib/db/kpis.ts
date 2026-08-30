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

    // Where that stock physically sits. Split the SAME number the card shows
    // (leftover, i.e. free-to-sell) rather than total_stock_api — the two differ
    // by the reserved units, and a breakdown that does not add up to the figure
    // above it is worse than no breakdown.
    //
    // Attribution is by GROUP, not by proportion: a group whose members are all
    // FBO/FBY contributes its leftover to fbo, all-FBS to fbs, and a genuinely
    // mixed group goes to `mixed` rather than being divided by a ratio nobody
    // measured. The three always sum to totalStock.
    //
    // Only meaningful across the whole account: the marketplace-filtered branch
    // has no groups to classify, so it reports no split at all.
    let stockSplit: { fbo: number; fbs: number; mixed: number } | undefined
    if (!marketplaceFiltered && groups.length > 0) {
      const isFboMember = (m: { fulfillment_type: string | null }) =>
        m.fulfillment_type === 'fbo' || m.fulfillment_type === 'fby'
      stockSplit = { fbo: 0, fbs: 0, mixed: 0 }
      for (const g of groups) {
        const anyFbo = g.members.some(isFboMember)
        const anyFbs = g.members.some(m => !isFboMember(m))
        const bucket = anyFbo && anyFbs ? 'mixed' : anyFbo ? 'fbo' : 'fbs'
        stockSplit[bucket] += g.leftover
      }
    }

    const result: Kpis = {
      total_revenue: current.revenue,
      total_profit: current.profit,
      margin_after_commission: current.marginAfterCommission,
      profit_cogs: current.cogs,
      profit_fees: current.fees,
      profit_revenue_counted: current.revenueCounted,
      missing_cost_products: current.missingCostProducts,
      counted_marketplaces: current.countedMarketplaces,
      pending_marketplaces: current.pendingMarketplaces,
      total_orders: current.orders,
      cancelled_orders: current.cancelled,
      cancelled_units: current.cancelledUnits,
      total_stock: totalStock,
      stock_fbo: stockSplit?.fbo,
      stock_fbs: stockSplit?.fbs,
      stock_mixed: stockSplit?.mixed,
      returned_orders: current.returned,
    }

    if (prevSinceDate) {
      const prev = await fetchPeriodKpis(shopIds, prevSinceDate, prevUntilDate)
      result.change_revenue = pct(current.revenue, prev.revenue)
      result.change_profit = pct(current.profit, prev.profit)
      // Margin badge compares like-for-like: this period's margin-after-commission
      // vs last period's, both revenue−fees over counted orders (#376).
      result.change_margin = pct(current.marginAfterCommission, prev.marginAfterCommission)
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
