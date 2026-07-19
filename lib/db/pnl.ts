import { inArray, gte, and, asc } from 'drizzle-orm'
import { db, orders } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import type { MarketplaceType } from '@/lib/types'

export interface MonthlyPnl {
  month: string
  revenue: number
  marketplace_fee: number
  delivery_cost: number
  net: number
  order_count: number
  /** cancelled orders in the month — excluded from every money figure, but
   *  shown so a month of activity never renders as "no data" */
  cancelled_count: number
  cancelled_amount: number
}

export async function getMonthlyPnl(months = 6, marketplace?: MarketplaceType): Promise<MonthlyPnl[]> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  // Fetch cancelled orders too: they must not count as revenue, but a month
  // whose only activity was cancellations should still appear in the report.
  const rows = await db.select({
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
    .orderBy(asc(orders.ordered_at))

  if (rows.length === 0) return []

  const grouped = new Map<string, {
    revenue: number; fee: number; delivery: number; count: number
    cancelledCount: number; cancelledAmount: number
  }>()

  for (const row of rows) {
    const d = row.ordered_at
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const ex = grouped.get(key) ?? {
      revenue: 0, fee: 0, delivery: 0, count: 0, cancelledCount: 0, cancelledAmount: 0,
    }
    if (row.status === 'cancelled') {
      ex.cancelledCount += 1
      ex.cancelledAmount += Number(row.revenue ?? 0)
    } else {
      ex.revenue  += Number(row.revenue ?? 0)
      ex.fee      += Number(row.marketplace_fee ?? 0)
      ex.delivery += Number(row.delivery_cost ?? 0)
      ex.count    += 1
    }
    grouped.set(key, ex)
  }

  return Array.from(grouped.entries()).map(([key, v]) => {
    const d = new Date(key + '-01')
    return {
      month:           d.toLocaleDateString('uz-UZ', { month: 'short', year: '2-digit' }),
      revenue:         v.revenue,
      marketplace_fee: v.fee,
      delivery_cost:   v.delivery,
      net:             v.revenue - v.fee - v.delivery,
      order_count:     v.count,
      cancelled_count: v.cancelledCount,
      cancelled_amount: v.cancelledAmount,
    }
  })
}
