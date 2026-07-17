import { unstable_cache } from 'next/cache'
import { inArray, desc, gte, lte, and, count } from 'drizzle-orm'
import { db, orders } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import type { Order, MarketplaceType } from '@/lib/types'

function mapRow(row: typeof orders.$inferSelect): Order {
  return {
    id:                row.id,
    shop_id:           row.shop_id,
    order_id_external: row.order_id_external,
    marketplace:       row.marketplace as Order['marketplace'],
    status:            row.status as Order['status'],
    revenue:           row.revenue ? Number(row.revenue) : null,
    marketplace_fee:   row.marketplace_fee ? Number(row.marketplace_fee) : null,
    delivery_cost:     row.delivery_cost ? Number(row.delivery_cost) : null,
    items_count:       row.items_count,
    ordered_at:        row.ordered_at.toISOString(),
  }
}

const _fetchOrders = unstable_cache(
  async (shopIdsStr: string, limit: number, from: string, to: string): Promise<Order[]> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return []

    const conditions = [inArray(orders.shop_id, shopIds)]
    if (from && to) {
      conditions.push(gte(orders.ordered_at, new Date(from)))
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
      conditions.push(lte(orders.ordered_at, toDate))
    }

    let query = db.select().from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.ordered_at))
      .$dynamic()
    if (limit > 0) query = query.limit(limit)

    const rows = await query
    return rows.map(mapRow)
  },
  ['orders'],
  { revalidate: 30, tags: ['order-data'] },
)

export async function getOrders(limit?: number, marketplace?: MarketplaceType, from?: string, to?: string): Promise<Order[]> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchOrders(shopIds.join(','), limit ?? 0, from ?? '', to ?? '')
}

export interface PaginatedOrders {
  rows: Order[]
  total: number
}

const _fetchOrdersPaginated = unstable_cache(
  async (shopIdsStr: string, page: number, pageSize: number): Promise<PaginatedOrders> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return { rows: [], total: 0 }

    const offset = (page - 1) * pageSize
    const condition = inArray(orders.shop_id, shopIds)

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(orders)
        .where(condition)
        .orderBy(desc(orders.ordered_at))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(orders).where(condition),
    ])

    return { rows: rows.map(mapRow), total }
  },
  ['orders-paginated'],
  { revalidate: 30, tags: ['order-data'] },
)

export async function getOrdersPaginated(page = 1, pageSize = 50, marketplace?: MarketplaceType): Promise<PaginatedOrders> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return { rows: [], total: 0 }
  return _fetchOrdersPaginated(shopIds.join(','), page, pageSize)
}
