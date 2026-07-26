import { inArray, gte, and, ne, eq, sql, asc } from 'drizzle-orm'
import { db, orders, orderItems, products, shops } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { PayoutEntry } from '@/lib/types'

export type { PayoutEntry }

export async function getPayoutEntries(): Promise<PayoutEntry[]> {
  const ue = await getUnitEcoSettings()
  const allShopIds = await getShopIds()
  if (!allShopIds || allShopIds.length === 0) return []

  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops)
    .where(inArray(shops.id, allShopIds))
  const mpByShop = new Map(shopRows.map(r => [r.id, r.marketplace]))

  const since = new Date()
  since.setMonth(since.getMonth() - 12)

  const [orderRows, cogsRows] = await Promise.all([
    db.select({
      shop_id: orders.shop_id,
      ordered_at: orders.ordered_at,
      status: orders.status,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
    }).from(orders)
      .where(and(
        inArray(orders.shop_id, allShopIds),
        gte(orders.ordered_at, since),
      ))
      .orderBy(asc(orders.ordered_at)),
    db.select({
      month: sql<string>`to_char(${orders.ordered_at}, 'YYYY-MM')`.as('month'),
      marketplace: orders.marketplace,
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`.as('cogs'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(
        inArray(orders.shop_id, allShopIds),
        gte(orders.ordered_at, since),
        ne(orders.status, 'cancelled'),
        ne(orders.status, 'returned'),
      ))
      .groupBy(sql`to_char(${orders.ordered_at}, 'YYYY-MM')`, orders.marketplace),
  ])

  if (orderRows.length === 0) return []

  const cogsMap = new Map(cogsRows.map(r => [`${r.month}|${r.marketplace}`, Number(r.cogs)]))

  type Bucket = {
    revenue: number; realFee: number; realDelivery: number
    count: number; returnCount: number; returnAmount: number
  }
  const grouped = new Map<string, Bucket>()

  for (const row of orderRows) {
    const d = row.ordered_at
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mp = mpByShop.get(row.shop_id) ?? 'uzum'
    const key = `${monthKey}|${mp}`
    const b = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0, count: 0, returnCount: 0, returnAmount: 0,
    }

    if (row.status === 'cancelled' || row.status === 'returned') {
      b.returnCount += 1
      b.returnAmount += Number(row.revenue ?? 0)
    } else {
      b.revenue += Number(row.revenue ?? 0)
      b.realFee += Number(row.marketplace_fee ?? 0)
      b.realDelivery += Number(row.delivery_cost ?? 0)
      b.count += 1
    }
    grouped.set(key, b)
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const entries: PayoutEntry[] = Array.from(grouped.entries()).map(([key, v]) => {
    const [monthKey, mp] = key.split('|')
    const estimated = v.realFee === 0 && v.revenue > 0
    const commission = estimated ? v.revenue * ue.defaultCommissionPct / 100 : v.realFee
    const delivery = v.realDelivery > 0 ? v.realDelivery : v.revenue * ue.lastMilePct / 100
    const acquiring = v.revenue * ue.acquiringPct / 100
    const tax = v.revenue * ue.taxPct / 100
    const adSpend = v.revenue * ue.adPct / 100
    const cogs = cogsMap.get(key) ?? 0
    const netPayout = v.revenue - commission - delivery - acquiring - tax - adSpend - cogs

    const isPast = monthKey < currentMonth

    return {
      id: key,
      period: monthKey,
      marketplace: mp,
      grossRevenue: v.revenue,
      commission,
      delivery,
      returns: v.returnAmount,
      adSpend,
      acquiring,
      tax,
      otherDeductions: cogs,
      netPayout,
      ordersCount: v.count,
      status: isPast ? 'paid' as const : 'pending' as const,
      payoutDate: isPast ? `${monthKey}-28` : null,
    }
  })

  entries.sort((a, b) => b.period.localeCompare(a.period))
  return entries
}
