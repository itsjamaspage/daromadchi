import { unstable_cache } from 'next/cache'
import { eq, ne, and, or, isNull, inArray, gte, lte, asc, sql, count } from 'drizzle-orm'
import { db, shops, products, orders, orderItems } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

export interface PaginatedProducts {
  rows: Product[]
  total: number
}

const _fetchProducts = unstable_cache(
  async (allShopIdsStr: string): Promise<Product[]> => {
    const allShopIds = allShopIdsStr ? allShopIdsStr.split(',') : []
    if (allShopIds.length === 0) return []

    const [productRows, soldRows, shopRows] = await Promise.all([
      db.select({
        id: products.id,
        shop_id: products.shop_id,
        sku: products.sku,
        title: products.title,
        cost_price: products.cost_price,
        selling_price: products.selling_price,
        stock_quantity: products.stock_quantity,
        category: products.category,
        marketplace_product_id: products.marketplace_product_id,
        updated_at: products.updated_at,
      }).from(products)
        .where(inArray(products.shop_id, allShopIds))
        .orderBy(asc(products.title)),
      db.select({
        product_id: orderItems.product_id,
        qty_sold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty_sold'),
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .where(inArray(orders.shop_id, allShopIds))
        .groupBy(orderItems.product_id),
      db.select({
        id: shops.id,
        marketplace: shops.marketplace,
        warehouse_id: shops.warehouse_id,
      }).from(shops).where(inArray(shops.id, allShopIds)),
    ])

    const soldByProductId = new Map<string, number>()
    for (const row of soldRows) {
      if (row.product_id) soldByProductId.set(row.product_id, Number(row.qty_sold))
    }

    const shopInfo = new Map<string, { marketplace: MarketplaceType; warehouseId: string | null }>()
    for (const s of shopRows) {
      shopInfo.set(s.id, { marketplace: s.marketplace as MarketplaceType, warehouseId: s.warehouse_id })
    }

    const groupTotalSold = new Map<string, number>()
    const groupShopCount = new Map<string, number>()
    for (const p of productRows) {
      if (!p.sku) continue
      const wid = shopInfo.get(p.shop_id)?.warehouseId
      if (!wid) continue
      const key = `${wid}:${p.sku}`
      const sold = soldByProductId.get(p.id) ?? 0
      groupTotalSold.set(key, (groupTotalSold.get(key) ?? 0) + sold)
      groupShopCount.set(key, (groupShopCount.get(key) ?? 0) + 1)
    }

    return productRows.map(p => {
      const sold = soldByProductId.get(p.id) ?? 0
      const wid = shopInfo.get(p.shop_id)?.warehouseId
      const key = wid && p.sku ? `${wid}:${p.sku}` : null
      const isShared = key ? (groupShopCount.get(key) ?? 0) > 1 : false
      const availableStock = isShared && key
        ? Math.max(0, p.stock_quantity - (groupTotalSold.get(key) ?? 0))
        : p.stock_quantity

      return {
        id: p.id,
        shop_id: p.shop_id,
        sku: p.sku,
        title: p.title,
        cost_price: p.cost_price ? Number(p.cost_price) : null,
        selling_price: p.selling_price ? Number(p.selling_price) : null,
        stock_quantity: p.stock_quantity,
        physical_stock: null,
        category: p.category,
        marketplace_product_id: p.marketplace_product_id,
        updated_at: p.updated_at.toISOString(),
        marketplace: shopInfo.get(p.shop_id)?.marketplace,
        available_stock: availableStock,
        profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        is_shared: isShared,
      } as Product
    })
  },
  ['products-v4'],
  { revalidate: 30 },
)

export async function getProducts(marketplace?: MarketplaceType): Promise<Product[]> {
  const allShopIds = await getShopIds()
  if (!allShopIds || allShopIds.length === 0) return []
  const all = await _fetchProducts(allShopIds.join(','))
  return marketplace ? all.filter(p => p.marketplace === marketplace) : all
}

export interface ProductSalesRow {
  product_id: string
  title: string
  sku: string | null
  qty_sold: number
  revenue: number
}

const _fetchProductSales = unstable_cache(
  async (shopIdsStr: string, days: number | null, from: string, to: string): Promise<ProductSalesRow[]> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return []

    let sinceDate: Date | null = null
    let untilDate: Date | null = null
    if (from && to) {
      sinceDate = new Date(from)
      untilDate = new Date(to)
      untilDate.setHours(23, 59, 59, 999)
    } else if (days !== null && days > 0) {
      sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - days)
    }

    const conditions = [
      inArray(orders.shop_id, shopIds),
    ]
    if (sinceDate) conditions.push(gte(orders.ordered_at, sinceDate))
    if (untilDate) conditions.push(lte(orders.ordered_at, untilDate))

    const rows = await db.select({
      product_id: orderItems.product_id,
      title: products.title,
      sku: products.sku,
      qty_sold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty_sold'),
      revenue: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price_per_unit}), 0)`.as('revenue'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .innerJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions))
      .groupBy(orderItems.product_id, products.title, products.sku)

    return rows.map(r => ({
      product_id: r.product_id!,
      title: r.title ?? 'Unknown',
      sku: r.sku ?? null,
      qty_sold: Number(r.qty_sold),
      revenue: Number(r.revenue),
    }))
  },
  ['product-sales-v3'],
  { revalidate: 30 },
)

export async function getProductSales(
  days: number | null,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<ProductSalesRow[]> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchProductSales(shopIds.join(','), days, from ?? '', to ?? '')
}

export interface CategoryRow {
  name: string
  revenue: number
  profit: number
  percent: number
}

const _fetchCategoryRevenue = unstable_cache(
  async (shopIdsStr: string, days: number, from: string, to: string): Promise<CategoryRow[]> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return []

    let sinceDate: Date | null = null
    let untilDate: Date | null = null
    if (from && to) {
      sinceDate = new Date(from)
      untilDate = new Date(to)
      untilDate.setHours(23, 59, 59, 999)
    } else if (days > 0) {
      sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - days + 1)
    }

    const conditions = [
      inArray(orders.shop_id, shopIds),
    ]
    if (sinceDate) conditions.push(gte(orders.ordered_at, sinceDate))
    if (untilDate) conditions.push(lte(orders.ordered_at, untilDate))

    const rows = await db.select({
      name: sql<string>`coalesce(${products.category}, 'Uncategorized')`.as('name'),
      revenue: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price_per_unit}), 0)`.as('revenue'),
      profit: sql<number>`coalesce(sum(${orderItems.quantity} * (${orderItems.price_per_unit} - coalesce(${orderItems.cost_per_unit}, ${products.cost_price}, 0))), 0)`.as('profit'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .innerJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions))
      .groupBy(products.category)

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0)
    return rows.map(r => ({
      name: r.name,
      revenue: Number(r.revenue),
      profit: Number(r.profit),
      percent: totalRevenue > 0 ? Math.round((Number(r.revenue) / totalRevenue) * 100) : 0,
    }))
  },
  ['category-revenue-rpc'],
  { revalidate: 30 },
)

export async function getCategoryRevenue(
  days: number,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<CategoryRow[]> {
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchCategoryRevenue(shopIds.join(','), days, from ?? '', to ?? '')
}

const _fetchProductsPaginated = unstable_cache(
  async (userId: string, marketplace: string | null, page: number, pageSize: number): Promise<PaginatedProducts> => {
    const offset = (page - 1) * pageSize

    const shopConditions = [
      eq(shops.user_id, userId),
      or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO')),
    ]
    if (marketplace) shopConditions.push(eq(shops.marketplace, marketplace as MarketplaceType))

    const userShops = await db.select({ id: shops.id, marketplace: shops.marketplace, warehouse_id: shops.warehouse_id })
      .from(shops).where(and(...shopConditions))
    const shopIds = userShops.map(s => s.id)
    if (shopIds.length === 0) return { rows: [], total: 0 }

    const shopInfo = new Map<string, { marketplace: MarketplaceType; warehouseId: string | null }>()
    for (const s of userShops) {
      shopInfo.set(s.id, { marketplace: s.marketplace as MarketplaceType, warehouseId: s.warehouse_id })
    }

    const [productRows, [{ total }]] = await Promise.all([
      db.select({
        id: products.id,
        shop_id: products.shop_id,
        sku: products.sku,
        title: products.title,
        cost_price: products.cost_price,
        selling_price: products.selling_price,
        stock_quantity: products.stock_quantity,
        category: products.category,
        marketplace_product_id: products.marketplace_product_id,
        updated_at: products.updated_at,
      }).from(products)
        .where(inArray(products.shop_id, shopIds))
        .orderBy(asc(products.title))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(products).where(inArray(products.shop_id, shopIds)),
    ])

    const productIds = productRows.map(p => p.id)
    const soldRows = productIds.length > 0
      ? await db.select({
          product_id: orderItems.product_id,
          qty_sold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty_sold'),
        }).from(orderItems)
          .innerJoin(orders, eq(orderItems.order_id, orders.id))
          .where(inArray(orderItems.product_id, productIds))
          .groupBy(orderItems.product_id)
      : []

    const soldMap = new Map<string, number>()
    for (const r of soldRows) {
      if (r.product_id) soldMap.set(r.product_id, Number(r.qty_sold))
    }

    const groupTotalSold = new Map<string, number>()
    const groupShopCount = new Map<string, number>()
    for (const p of productRows) {
      if (!p.sku) continue
      const wid = shopInfo.get(p.shop_id)?.warehouseId
      if (!wid) continue
      const key = `${wid}:${p.sku}`
      groupTotalSold.set(key, (groupTotalSold.get(key) ?? 0) + (soldMap.get(p.id) ?? 0))
      groupShopCount.set(key, (groupShopCount.get(key) ?? 0) + 1)
    }

    const rows: Product[] = productRows.map(p => {
      const sold = soldMap.get(p.id) ?? 0
      const wid = shopInfo.get(p.shop_id)?.warehouseId
      const key = wid && p.sku ? `${wid}:${p.sku}` : null
      const isShared = key ? (groupShopCount.get(key) ?? 0) > 1 : false
      const availableStock = isShared && key
        ? Math.max(0, p.stock_quantity - (groupTotalSold.get(key) ?? 0))
        : p.stock_quantity

      return {
        id: p.id,
        shop_id: p.shop_id,
        sku: p.sku,
        title: p.title,
        cost_price: p.cost_price ? Number(p.cost_price) : null,
        selling_price: p.selling_price ? Number(p.selling_price) : null,
        stock_quantity: p.stock_quantity,
        physical_stock: null,
        category: p.category,
        marketplace_product_id: p.marketplace_product_id,
        updated_at: p.updated_at.toISOString(),
        marketplace: shopInfo.get(p.shop_id)?.marketplace,
        available_stock: availableStock,
        profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        is_shared: isShared,
      } as Product
    })

    return { rows, total }
  },
  ['products-paginated-rpc'],
  { revalidate: 30 },
)

export async function getProductsPaginated(page = 1, pageSize = 50, marketplace?: MarketplaceType): Promise<PaginatedProducts> {
  const userId = await getCurrentUserId()
  if (!userId) return { rows: [], total: 0 }
  return _fetchProductsPaginated(userId, marketplace ?? null, page, pageSize)
}
