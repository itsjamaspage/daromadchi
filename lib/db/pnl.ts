import { inArray, gte, and, asc, ne, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products, productAdsStats } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { MarketplaceType } from '@/lib/types'

/**
 * Daily P&L with a full expense breakdown. Marketplaces rarely report fees
 * per order (Uzum's seller API doesn't), so where real numbers are missing the
 * expense lines are ESTIMATED from the user's Unit Economics parameters
 * (commission %, acquiring %, tax %, ad %, last-mile %) — the same numbers
 * they already maintain on the Unit Economics page. COGS comes from each
 * product's cost price × units sold. Cancelled orders are excluded from every
 * money figure but shown as a count so a cancellation-only day still renders.
 */
export interface MonthlyPnl {
  /** raw YYYY-MM-DD key */
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
  penalty: number
  storageFee: number
  additionalPayment: number
  /** true when commission/delivery came from percentages, not marketplace data */
  estimated: boolean
  adSpendEstimated: boolean
}

export interface PnlParams {
  commissionPct: number
  acquiringPct: number
  taxPct: number
  adPct: number
  lastMilePct: number
}

export async function getMonthlyPnl(
  days = 30,
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
  since.setDate(since.getDate() - days)

  const sinceStr = since.toISOString().slice(0, 10)
  const [rows, cogsRows, adSpendRows] = await Promise.all([
    db.select({
      ordered_at: orders.ordered_at,
      status: orders.status,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
      penalty: orders.penalty,
      storage_fee: orders.storage_fee,
      additional_payment: orders.additional_payment,
    }).from(orders)
      .where(and(
        inArray(orders.shop_id, shopIds),
        gte(orders.ordered_at, since),
      ))
      .orderBy(asc(orders.ordered_at)),
    db.select({
      month: sql<string>`to_char(${orders.ordered_at}, 'YYYY-MM-DD')`.as('month'),
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
      .groupBy(sql`to_char(${orders.ordered_at}, 'YYYY-MM-DD')`),
    db.select({
      month: sql<string>`to_char(${productAdsStats.date}::date, 'YYYY-MM-DD')`.as('month'),
      spend: sql<number>`coalesce(sum(${productAdsStats.spend}), 0)`.as('spend'),
    }).from(productAdsStats)
      .where(and(
        inArray(productAdsStats.shop_id, shopIds),
        gte(productAdsStats.date, sinceStr),
      ))
      .groupBy(sql`to_char(${productAdsStats.date}::date, 'YYYY-MM-DD')`),
  ])

  if (rows.length === 0) return { rows: [], params }

  const cogsByMonth = new Map(cogsRows.map(r => [r.month, Number(r.cogs)]))
  const realAdSpendByMonth = new Map(adSpendRows.map(r => [r.month, Number(r.spend)]))

  const grouped = new Map<string, {
    revenue: number; realFee: number; realDelivery: number; count: number
    cancelledCount: number; cancelledAmount: number
    penalty: number; storageFee: number; additionalPayment: number
  }>()

  for (const row of rows) {
    const d = row.ordered_at
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const ex = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0, count: 0, cancelledCount: 0, cancelledAmount: 0,
      penalty: 0, storageFee: 0, additionalPayment: 0,
    }
    if (row.status === 'cancelled' || row.status === 'returned') {
      ex.cancelledCount += 1
      ex.cancelledAmount += Number(row.revenue ?? 0)
    } else {
      ex.revenue      += Number(row.revenue ?? 0)
      ex.realFee      += Number(row.marketplace_fee ?? 0)
      ex.realDelivery += Number(row.delivery_cost ?? 0)
      ex.penalty      += Number(row.penalty ?? 0)
      ex.storageFee   += Number(row.storage_fee ?? 0)
      ex.additionalPayment += Number(row.additional_payment ?? 0)
      ex.count        += 1
    }
    grouped.set(key, ex)
  }

  const result = Array.from(grouped.entries()).map(([key, v]) => {
    const d = new Date(key + 'T00:00:00')
    // Real marketplace numbers when present; the user's percentages otherwise.
    const estimated  = v.realFee === 0 && v.revenue > 0
    const commission = estimated ? v.revenue * params.commissionPct / 100 : v.realFee
    const delivery   = v.realDelivery > 0 ? v.realDelivery : v.revenue * params.lastMilePct / 100
    // Acquiring is bundled into marketplace commission. Only add as
    // separate estimate when commission itself is estimated.
    const acquiring  = estimated ? v.revenue * params.acquiringPct / 100 : 0
    const realAdSpend = realAdSpendByMonth.get(key) ?? 0
    const adSpendEstimated = realAdSpend === 0 && v.revenue > 0
    const ads = adSpendEstimated ? v.revenue * params.adPct / 100 : realAdSpend
    const cogs       = cogsByMonth.get(key) ?? 0
    const penalty    = v.penalty
    const storageFee = v.storageFee
    const additionalPayment = v.additionalPayment
    const taxBase    = ue.taxType === 'income'
      ? v.revenue
      : Math.max(v.revenue - commission - delivery - acquiring - ads - cogs - penalty - storageFee - additionalPayment, 0)
    const tax        = taxBase * params.taxPct / 100
    return {
      monthKey:         key,
      month:            d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: '2-digit' }),
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
      penalty,
      storageFee,
      additionalPayment,
      net: v.revenue - commission - delivery - acquiring - tax - ads - cogs - penalty - storageFee - additionalPayment,
      estimated,
      adSpendEstimated,
    }
  })

  return { rows: result, params }
}
