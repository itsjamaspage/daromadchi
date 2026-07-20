import { inArray, gte, and, asc, ne, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { MarketplaceType } from '@/lib/types'

/**
 * Monthly P&L with a full expense breakdown. Marketplaces rarely report fees
 * per order (Uzum's seller API doesn't), so where real numbers are missing the
 * expense lines are ESTIMATED from the user's Unit Economics parameters
 * (commission %, acquiring %, tax %, ad %, last-mile %) — the same numbers
 * they already maintain on the Unit Economics page. COGS comes from each
 * product's cost price × units sold. Cancelled orders are excluded from every
 * money figure but shown as a count so a cancellation-only month still renders.
 */
export interface MonthlyPnl {
  /** raw YYYY-MM key — format it with the UI language's locale in the page */
  monthKey: string
  month: string
  order_count: number
  cancelled_count: number
  cancelled_amount: number
  revenue: number
  commission: number
  delivery: number
  acquiring: number
  tax: number
  ads: number
  cogs: number
  net: number
  /** true when commission/delivery came from percentages, not marketplace data */
  estimated: boolean
}

export interface PnlParams {
  commissionPct: number
  acquiringPct: number
  taxPct: number
  adPct: number
  lastMilePct: number
}

export async function getMonthlyPnl(
  months = 6,
  marketplace?: MarketplaceType,
): Promise<{ rows: MonthlyPnl[]; params: PnlParams }> {
  const ue = await getUnitEcoSettings()
  const params: PnlParams = {
    commissionPct: ue.defaultCommissionPct,
    acquiringPct: ue.acquiringPct,
    taxPct: ue.taxPct,
    adPct: ue.adPct,
    lastMilePct: ue.lastMilePct,
  }

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return { rows: [], params }

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const [rows, cogsRows] = await Promise.all([
    db.select({
      ordered_at: orders.ordered_at,
      status: orders.status,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
    }).from(orders)
      .where(and(
        inArray(orders.shop_id, shopIds),
        gte(orders.ordered_at, since),
      ))
      .orderBy(asc(orders.ordered_at)),
    // COGS per month: units × product cost price on non-cancelled orders.
    db.select({
      month: sql<string>`to_char(${orders.ordered_at}, 'YYYY-MM')`.as('month'),
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`.as('cogs'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        gte(orders.ordered_at, since),
        ne(orders.status, 'cancelled'),
        ne(orders.status, 'returned'),
      ))
      .groupBy(sql`to_char(${orders.ordered_at}, 'YYYY-MM')`),
  ])

  if (rows.length === 0) return { rows: [], params }

  const cogsByMonth = new Map(cogsRows.map(r => [r.month, Number(r.cogs)]))

  const grouped = new Map<string, {
    revenue: number; realFee: number; realDelivery: number; count: number
    cancelledCount: number; cancelledAmount: number
  }>()

  for (const row of rows) {
    const d = row.ordered_at
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const ex = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0, count: 0, cancelledCount: 0, cancelledAmount: 0,
    }
    if (row.status === 'cancelled') {
      ex.cancelledCount += 1
      ex.cancelledAmount += Number(row.revenue ?? 0)
    } else {
      ex.revenue      += Number(row.revenue ?? 0)
      ex.realFee      += Number(row.marketplace_fee ?? 0)
      ex.realDelivery += Number(row.delivery_cost ?? 0)
      ex.count        += 1
    }
    grouped.set(key, ex)
  }

  const result = Array.from(grouped.entries()).map(([key, v]) => {
    const d = new Date(key + '-01')
    // Real marketplace numbers when present; the user's percentages otherwise.
    const estimated  = v.realFee === 0 && v.revenue > 0
    const commission = estimated ? v.revenue * params.commissionPct / 100 : v.realFee
    const delivery   = v.realDelivery > 0 ? v.realDelivery : v.revenue * params.lastMilePct / 100
    const acquiring  = v.revenue * params.acquiringPct / 100
    const ads        = v.revenue * params.adPct / 100
    const cogs       = cogsByMonth.get(key) ?? 0
    const taxBase    = ue.taxType === 'income'
      ? v.revenue
      : Math.max(v.revenue - commission - delivery - acquiring - ads - cogs, 0)
    const tax        = taxBase * params.taxPct / 100
    return {
      monthKey:         key,
      month:            d.toLocaleDateString('uz-UZ', { month: 'short', year: '2-digit' }),
      order_count:      v.count,
      cancelled_count:  v.cancelledCount,
      cancelled_amount: v.cancelledAmount,
      revenue:          v.revenue,
      commission,
      delivery,
      acquiring,
      tax,
      ads,
      cogs,
      net: v.revenue - commission - delivery - acquiring - tax - ads - cogs,
      estimated,
    }
  })

  return { rows: result, params }
}
