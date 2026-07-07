import { unstable_cache } from 'next/cache'
import { inArray, gte, lte, ne, and, sql } from 'drizzle-orm'
import { db, orders } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import type { DailyRevenue, MarketplaceType } from '@/lib/types'

const _fetchRevenue = unstable_cache(
  async (shopIdsStr: string, days: number, from: string, to: string): Promise<DailyRevenue[]> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return []

    let sinceDate: Date
    let untilDate: Date | null = null

    if (from) {
      sinceDate = new Date(from)
      untilDate = to ? new Date(to + 'T23:59:59') : null
    } else {
      sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - days + 1)
    }

    const conditions = [
      inArray(orders.shop_id, shopIds),
      ne(orders.status, 'cancelled'),
      gte(orders.ordered_at, sinceDate),
    ]
    if (untilDate) conditions.push(lte(orders.ordered_at, untilDate))

    const rows = await db.select({
      day: sql<string>`date(${orders.ordered_at})`.as('day'),
      revenue: sql<number>`coalesce(sum(${orders.revenue}::numeric), 0)`.as('revenue'),
      order_count: sql<number>`count(*)`.as('order_count'),
    }).from(orders)
      .where(and(...conditions))
      .groupBy(sql`date(${orders.ordered_at})`)
      .orderBy(sql`date(${orders.ordered_at})`)

    return rows.map(row => {
      const d = new Date(row.day)
      const label = d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })
      return {
        date: `${label} ${d.getFullYear()}`,
        revenue: Number(row.revenue),
        order_count: Number(row.order_count),
      }
    })
  },
  ['revenue-rpc'],
  { revalidate: 30 },
)

export async function getDailyRevenue(
  days = 7,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<DailyRevenue[]> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchRevenue(shopIds.join(','), days, from ?? '', to ?? '')
}
