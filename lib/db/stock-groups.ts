import { eq, and, inArray, gte, sql, notInArray } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, productLinks } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import type { MarketplaceType } from '@/lib/types'

/*
 * Cross-marketplace leftover tracking.
 *
 * Products are grouped across the user's shops by normalized seller article
 * (SKU) — the same article on Uzum, Wildberries and Yandex Market means the
 * same physical product. All numbers are computed from data already synced
 * READ-ONLY from the marketplaces; nothing is ever written back to a store.
 *
 * Two leftover modes per group:
 *  • api      — total leftover = sum of marketplace-reported stocks (FBO-style,
 *               goods stored at marketplace warehouses).
 *  • baseline — the user entered how many units they physically own
 *               (total_physical_stock); leftover = that number minus exact
 *               units sold across ALL marketplaces since it was entered
 *               (FBS-style, one shared stash shipped from the seller's side).
 */

// Sold = every non-cancelled, non-returned order item. Returned units go back
// to the shelf, so they don't reduce inventory.
const NOT_SOLD_STATUSES = ['cancelled', 'returned'] as const

export interface StockGroupMember {
  product_id: string
  marketplace: MarketplaceType
  title: string
  sku: string | null
  stock: number
  sold_total: number
  selling_price: number | null
}

export interface StockGroup {
  match_key: string
  title: string
  members: StockGroupMember[]
  /** marketplace → current marketplace-reported stock */
  stock_by_marketplace: Partial<Record<MarketplaceType, number>>
  /** marketplace → exact units sold (from synced orders) */
  sold_by_marketplace: Partial<Record<MarketplaceType, number>>
  total_stock_api: number
  total_sold: number
  /** user-entered physical quantity, null = api mode */
  total_physical_stock: number | null
  baseline_at: string | null
  stock_threshold: number | null
  sold_since_baseline: number
  mode: 'api' | 'baseline'
  /** total units left across all marketplaces */
  leftover: number
  /** units sold in the last 14 days (all marketplaces) */
  sold_14d: number
  /** leftover / daily velocity; null when no recent sales */
  days_of_stock: number | null
}

function normalizeKey(sku: string): string {
  return sku.trim().toLowerCase()
}

/** Session-scoped variant for dashboard pages and API routes. */
export async function getStockGroups(): Promise<StockGroup[]> {
  const [userId, shopIds] = await Promise.all([getCurrentUserId(), getShopIds()])
  if (!userId || !shopIds || shopIds.length === 0) return []
  return computeStockGroups(userId, shopIds)
}

/** Core aggregation — usable from cron jobs where there is no session. */
export async function computeStockGroups(userId: string, shopIds: string[]): Promise<StockGroup[]> {
  if (shopIds.length === 0) return []

  const since14d = new Date()
  since14d.setDate(since14d.getDate() - 14)

  const [productRows, shopRows, soldRows, sold14Rows, linkRows] = await Promise.all([
    db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      title: products.title,
      selling_price: products.selling_price,
      stock_quantity: products.stock_quantity,
    }).from(products).where(inArray(products.shop_id, shopIds)),
    db.select({ id: shops.id, marketplace: shops.marketplace })
      .from(shops).where(inArray(shops.id, shopIds)),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        notInArray(orders.status, [...NOT_SOLD_STATUSES]),
      ))
      .groupBy(orderItems.product_id),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        notInArray(orders.status, [...NOT_SOLD_STATUSES]),
        gte(orders.ordered_at, since14d),
      ))
      .groupBy(orderItems.product_id),
    db.select().from(productLinks).where(eq(productLinks.user_id, userId)),
  ])

  const mpByShop = new Map(shopRows.map(s => [s.id, s.marketplace as MarketplaceType]))
  const soldByProduct = new Map(soldRows.map(r => [r.product_id, Number(r.qty)]))
  const sold14ByProduct = new Map(sold14Rows.map(r => [r.product_id, Number(r.qty)]))
  const linkByKey = new Map(linkRows.map(l => [l.match_key, l]))

  // Group products by normalized SKU; products without a SKU stand alone.
  const groups = new Map<string, StockGroupMember[]>()
  for (const p of productRows) {
    const key = p.sku ? normalizeKey(p.sku) : `#${p.id}`
    const member: StockGroupMember = {
      product_id: p.id,
      marketplace: mpByShop.get(p.shop_id) ?? 'uzum',
      title: p.title,
      sku: p.sku,
      stock: p.stock_quantity,
      sold_total: soldByProduct.get(p.id) ?? 0,
      selling_price: p.selling_price ? Number(p.selling_price) : null,
    }
    const list = groups.get(key)
    if (list) list.push(member)
    else groups.set(key, [member])
  }

  // Exact sold-since-baseline counts, one grouped query for all baselines.
  // Each group can have its own baseline date, so we take the per-product
  // sold sums since the OLDEST baseline bucketed by day and filter in JS.
  const baselineKeys = [...linkByKey.values()].filter(l =>
    l.total_physical_stock != null && l.baseline_at != null && groups.has(l.match_key))
  const soldSinceBaseline = new Map<string, number>() // match_key → qty
  if (baselineKeys.length > 0) {
    const oldest = new Date(Math.min(...baselineKeys.map(l => l.baseline_at!.getTime())))
    const memberIds = baselineKeys.flatMap(l => groups.get(l.match_key)!.map(m => m.product_id))
    const productToKey = new Map<string, string>()
    for (const l of baselineKeys) {
      for (const m of groups.get(l.match_key)!) productToKey.set(m.product_id, l.match_key)
    }
    const rows = await db.select({
      product_id: orderItems.product_id,
      day: sql<string>`date_trunc('day', ${orders.ordered_at})`.as('day'),
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        notInArray(orders.status, [...NOT_SOLD_STATUSES]),
        gte(orders.ordered_at, oldest),
        inArray(orderItems.product_id, memberIds),
      ))
      .groupBy(orderItems.product_id, sql`date_trunc('day', ${orders.ordered_at})`)

    for (const r of rows) {
      if (!r.product_id) continue
      const key = productToKey.get(r.product_id)
      if (!key) continue
      const link = linkByKey.get(key)!
      if (new Date(r.day).getTime() >= new Date(link.baseline_at!).setUTCHours(0, 0, 0, 0)) {
        soldSinceBaseline.set(key, (soldSinceBaseline.get(key) ?? 0) + Number(r.qty))
      }
    }
  }

  const result: StockGroup[] = []
  for (const [key, members] of groups) {
    const link = linkByKey.get(key)

    const stockByMp: Partial<Record<MarketplaceType, number>> = {}
    const soldByMp: Partial<Record<MarketplaceType, number>> = {}
    let totalStock = 0
    let totalSold = 0
    let sold14 = 0
    for (const m of members) {
      stockByMp[m.marketplace] = (stockByMp[m.marketplace] ?? 0) + m.stock
      soldByMp[m.marketplace] = (soldByMp[m.marketplace] ?? 0) + m.sold_total
      totalStock += m.stock
      totalSold += m.sold_total
      sold14 += sold14ByProduct.get(m.product_id) ?? 0
    }

    const hasBaseline = link?.total_physical_stock != null && link.baseline_at != null
    const sinceBaseline = soldSinceBaseline.get(key) ?? 0
    const leftover = hasBaseline
      ? Math.max(0, link!.total_physical_stock! - sinceBaseline)
      : totalStock

    const dailyVelocity = sold14 / 14
    result.push({
      match_key: key,
      title: members[0].title,
      members,
      stock_by_marketplace: stockByMp,
      sold_by_marketplace: soldByMp,
      total_stock_api: totalStock,
      total_sold: totalSold,
      total_physical_stock: link?.total_physical_stock ?? null,
      baseline_at: link?.baseline_at?.toISOString() ?? null,
      stock_threshold: link?.stock_threshold ?? null,
      sold_since_baseline: sinceBaseline,
      mode: hasBaseline ? 'baseline' : 'api',
      leftover,
      sold_14d: sold14,
      days_of_stock: dailyVelocity > 0 ? Math.floor(leftover / dailyVelocity) : null,
    })
  }

  // Lowest leftover first — the products that need attention float to the top.
  result.sort((a, b) => a.leftover - b.leftover || b.total_sold - a.total_sold)
  return result
}

/** Groups at or below their alert threshold (per-group, else the given default). */
export function lowStockGroups(all: StockGroup[], defaultThreshold: number): StockGroup[] {
  return all.filter(g => g.leftover <= (g.stock_threshold ?? defaultThreshold))
}
