import { unstable_cache } from 'next/cache'
import { inArray, desc, gte, lte, and, count, eq } from 'drizzle-orm'
import { db, orders, shops } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import type { Order, MarketplaceType } from '@/lib/types'

function mapRow(row: typeof orders.$inferSelect, shopRow?: { shop_id_external: string | null; business_id: string | null }): Order {
  return {
    id:                row.id,
    shop_id:           row.shop_id,
    order_id_external: row.order_id_external,
    marketplace:       row.marketplace as Order['marketplace'],
    fulfillment_type:  row.fulfillment_type,
    status:            row.status as Order['status'],
    marketplace_status: row.marketplace_status,
    revenue:           row.revenue ? Number(row.revenue) : null,
    marketplace_fee:   row.marketplace_fee ? Number(row.marketplace_fee) : null,
    delivery_cost:     row.delivery_cost ? Number(row.delivery_cost) : null,
    items_count:       row.items_count,
    ordered_at:        row.ordered_at.toISOString(),
    shop_id_external:  shopRow?.shop_id_external ?? null,
    business_id:       shopRow?.business_id ?? null,
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

    let query = db.select({
      order: orders,
      shop_id_external: shops.shop_id_external,
      business_id: shops.business_id,
    }).from(orders)
      .leftJoin(shops, eq(orders.shop_id, shops.id))
      .where(and(...conditions))
      .orderBy(desc(orders.ordered_at))
      .$dynamic()
    if (limit > 0) query = query.limit(limit)

    const rows = await query
    return rows.map(r => mapRow(r.order, { shop_id_external: r.shop_id_external, business_id: r.business_id }))
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
      db.select({
        order: orders,
        shop_id_external: shops.shop_id_external,
        business_id: shops.business_id,
      }).from(orders)
        .leftJoin(shops, eq(orders.shop_id, shops.id))
        .where(condition)
        .orderBy(desc(orders.ordered_at))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(orders).where(condition),
    ])

    return { rows: rows.map(r => mapRow(r.order, { shop_id_external: r.shop_id_external, business_id: r.business_id })), total }
  },
  ['orders-paginated'],
  { revalidate: 30, tags: ['order-data'] },
)

export async function getOrdersPaginated(page = 1, pageSize = 50, marketplace?: MarketplaceType): Promise<PaginatedOrders> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return { rows: [], total: 0 }
  return _fetchOrdersPaginated(shopIds.join(','), page, pageSize)
}
