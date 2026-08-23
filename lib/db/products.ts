import { unstable_cache } from 'next/cache'
import { eq, ne, and, or, isNull, inArray, gte, lte, asc, sql, count } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, categoryAliases, categoriesCanonical } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

export interface PaginatedProducts {
  rows: Product[]
  total: number         // count for the CURRENT view (active, or archived)
  archivedTotal: number // count of archived products, always — powers the "Архивные" tab badge
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
        quantity_sold: products.quantity_sold,
        category: products.category,
        marketplace_product_id: products.marketplace_product_id,
        fulfillment_type: products.fulfillment_type,
        variant_group_key: products.variant_group_key,
        variant_color: products.variant_color,
        updated_at: products.updated_at,
      }).from(products)
        // Active metrics (dashboard home, analytics, ABC-XYZ) exclude archived.
        .where(and(inArray(products.shop_id, allShopIds), eq(products.is_archived, false)))
        .orderBy(asc(products.title)),
      db.select({
        product_id: orderItems.product_id,
        qty_sold: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.as('qty_sold'),
        qty_in_transit: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} in ('pending','confirmed')), 0)`.as('qty_in_transit'),
        qty_cancelled: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'cancelled'), 0)`.as('qty_cancelled'),
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
    const inTransitByProductId = new Map<string, number>()
    const cancelledByProductId = new Map<string, number>()
    for (const row of soldRows) {
      if (row.product_id) {
        soldByProductId.set(row.product_id, Number(row.qty_sold))
        inTransitByProductId.set(row.product_id, Number(row.qty_in_transit))
        cancelledByProductId.set(row.product_id, Number(row.qty_cancelled))
      }
    }

    const shopInfo = new Map<string, { marketplace: MarketplaceType; warehouseId: string | null }>()
    for (const s of shopRows) {
      shopInfo.set(s.id, { marketplace: s.marketplace as MarketplaceType, warehouseId: s.warehouse_id })
    }

    const groupShopCount = new Map<string, number>()
    const groupMaxStock = new Map<string, number>()
    const groupTotalPending = new Map<string, number>()
    // Same grouping logic as the Stocks page (lib/db/stock-groups.ts):
    // FBO/FBY warehouses are independent per marketplace → SUM them.
    // FBS / unknown share one physical pool → MAX to avoid double-count.
    // Total physical = FBS max + FBO sum. Exposed as a per-row field
    // so the Products page can show "per-listing / physical total".
    const groupFbsMax = new Map<string, number>()
    const groupFboSum = new Map<string, number>()
    for (const p of productRows) {
      if (!p.sku) continue
      const key = p.sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
      groupShopCount.set(key, (groupShopCount.get(key) ?? 0) + 1)
      groupMaxStock.set(key, Math.max(groupMaxStock.get(key) ?? 0, p.stock_quantity))
      const isFbs = p.fulfillment_type === 'fbs' || p.fulfillment_type === null
      if (isFbs) {
        groupFbsMax.set(key, Math.max(groupFbsMax.get(key) ?? 0, p.stock_quantity))
        groupTotalPending.set(key, (groupTotalPending.get(key) ?? 0) + (inTransitByProductId.get(p.id) ?? 0))
      } else {
        groupFboSum.set(key, (groupFboSum.get(key) ?? 0) + p.stock_quantity)
      }
    }

    return productRows.map(p => {
      const orderSold = soldByProductId.get(p.id) ?? 0
      const sold = p.quantity_sold != null ? p.quantity_sold : orderSold
      const dbInTransit = inTransitByProductId.get(p.id) ?? 0
      const surplus = p.quantity_sold != null ? Math.max(p.quantity_sold - orderSold, 0) : 0
      const deliveredUnits = Math.max(orderSold - dbInTransit, 0)
      const key = p.sku ? p.sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '') : null
      const isShared = key ? (groupShopCount.get(key) ?? 0) > 1 : false
      const availableStock = Math.max(0, p.stock_quantity - dbInTransit)
      const totalPhysical = key
        ? (groupFbsMax.get(key) ?? 0) + (groupFboSum.get(key) ?? 0)
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
        fulfillment_type: p.fulfillment_type,
        updated_at: p.updated_at.toISOString(),
        marketplace: shopInfo.get(p.shop_id)?.marketplace,
        available_stock: availableStock,
        total_physical: totalPhysical,
        profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        delivered: deliveredUnits,
        in_transit: dbInTransit + surplus,
        cancelled: cancelledByProductId.get(p.id) ?? 0,
        is_shared: isShared,
        variant_group_key: p.variant_group_key,
        variant_color: p.variant_color,
      } as Product
    })
  },
  // v10: added variant_group_key/variant_color so the Analytics margin table can
  // group (it was starved of the keys → every row fell to a flat row). Bumped so
  // stale v9 rows (missing the fields) aren't served during the revalidate window.
  ['products-v10'],
  { revalidate: 30, tags: ['product-data'] },
)

export async function getProducts(marketplace?: MarketplaceType): Promise<Product[]> {
  const allShopIds = await getShopIds()
  if (!allShopIds || allShopIds.length === 0) return []
  const all = await _fetchProducts(allShopIds.join(','))
  return marketplace ? all.filter(p => p.marketplace === marketplace) : all
}

export interface ProductSalesRow {
  product_id: string | null
  title: string
  sku: string | null
  qty_sold: number      // units on real sales (cancelled/returned excluded)
  qty_in_transit: number // subset of qty_sold not yet delivered (pending/confirmed)
  qty_cancelled: number // units on cancelled orders, shown separately
  qty_returned: number
  revenue: number       // revenue of real sales only
  // Variant grouping keys — carried through from products so the Analytics
  // "Top sold" table can collapse per-colour listings under a parent row.
  // Both stay NULL when the order's product was hard-deleted (orphan case):
  // NULL key = "flat row, don't try to group", same rule products use for
  // legitimately single-variant products. LEFT JOIN preserves the orphan.
  variant_group_key: string | null
  variant_color: string | null
  // Which marketplace this product's sales came from, so the UI can badge each
  // Top-products row (UZ / YM / WB). A product belongs to one shop → one
  // marketplace, so grouping by it never fragments a row. NULL only on the
  // orphan/hard-deleted case (filtered out of the sold list anyway).
  marketplace: MarketplaceType | null
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

    // Cancelled/returned units are NOT sales — they are counted separately so
    // the UI can show everything that happened in the store, in real units.
    // LEFT join on products: an order item whose product link failed to
    // resolve must still be visible, not silently dropped. Variant fields
    // ride along on the same LEFT JOIN — orphan rows come back with
    // variant_group_key NULL, which the client-side grouping treats as
    // "flat row, do not group" (same rule as single-variant products).
    const rows = await db.select({
      product_id: orderItems.product_id,
      title: products.title,
      sku: products.sku,
      variant_group_key: products.variant_group_key,
      variant_color: products.variant_color,
      marketplace: orders.marketplace,
      qty_sold: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.as('qty_sold'),
      qty_in_transit: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} in ('pending','confirmed')), 0)`.as('qty_in_transit'),
      qty_cancelled: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'cancelled'), 0)`.as('qty_cancelled'),
      qty_returned: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'returned'), 0)`.as('qty_returned'),
      // Revenue = COMPLETED sales only (delivered). Excludes cancelled/returned
      // AND still-in-process (pending/confirmed), matching the delivered-only
      // rule. qty_sold below already resolves to delivered units on its own
      // (its broader filter minus qty_in_transit = delivered), so only the
      // money figure needed tightening here.
      revenue: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price_per_unit}) filter (where ${orders.status} = 'delivered'), 0)`.as('revenue'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions))
      .groupBy(orderItems.product_id, products.title, products.sku, products.variant_group_key, products.variant_color, orders.marketplace)

    // Reconcile with Uzum's lifetime quantitySold on the unfiltered view: the
    // counter increments at ORDER time while fresh orders are hidden from the
    // order API, so its surplus over DB-visible units means "ordered, not yet
    // delivered" → shown under in-transit, never under sold. Period-filtered
    // views stay DB-only (a lifetime counter can't be sliced by date).
    const surplusByProduct = new Map<string, number>()
    const extraRows: ProductSalesRow[] = []
    if (!sinceDate && !untilDate) {
      // marketplace isn't a products column (it lives on shops), so map it via
      // the product's shop for the no-order rows below.
      const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
        .from(shops).where(inArray(shops.id, shopIds))
      const mpByShop = new Map(shopRows.map(s => [s.id, s.marketplace]))
      // Archived listings are excluded on purpose. The surplus below is derived
      // from Uzum's LIFETIME quantity_sold counter, which keeps its value after a
      // listing is delisted — so a dead listing with an unreconciled count kept
      // emitting a synthetic "1 in process" row that nothing could ever clear (no
      // order will arrive to reconcile it). A delisted product has no units in
      // transit, so it gets no synthetic units at all: neither a phantom row here
      // nor a surplus added to a real one. Its genuine orders are untouched —
      // they come from the orders join above and stay in the history.
      const prodRows = await db.select({
        id: products.id, title: products.title, sku: products.sku, quantity_sold: products.quantity_sold,
        variant_group_key: products.variant_group_key, variant_color: products.variant_color, shop_id: products.shop_id,
      }).from(products).where(and(inArray(products.shop_id, shopIds), eq(products.is_archived, false)))
      const dbUnits = new Map(rows.filter(r => r.product_id).map(r => [r.product_id as string, Number(r.qty_sold)]))
      const seen = new Set(rows.map(r => r.product_id))
      for (const p of prodRows) {
        if (p.quantity_sold == null) continue
        const surplus = Math.max(p.quantity_sold - (dbUnits.get(p.id) ?? 0), 0)
        if (surplus <= 0) continue
        if (seen.has(p.id)) {
          surplusByProduct.set(p.id, surplus)
        } else {
          // No order rows at all for this product — still show its ordered units.
          extraRows.push({
            product_id: p.id, title: p.title, sku: p.sku ?? null,
            qty_sold: 0, qty_in_transit: surplus, qty_cancelled: 0, qty_returned: 0, revenue: 0,
            variant_group_key: p.variant_group_key ?? null,
            variant_color: p.variant_color ?? null,
            marketplace: mpByShop.get(p.shop_id) ?? null,
          })
        }
      }
    }

    const mapped = rows
      // Drop orphan rows whose product was hard-deleted (product_id NULL). They
      // surfaced as a single "Удалённый товар" line — confusing and often the
      // top row by revenue. Their orders still count in the KPIs/P&L; they're
      // just not shown as a phantom product in the per-product Top Sales list.
      .filter(r => r.product_id != null)
      .map(r => {
      const dbInTransit = Number(r.qty_in_transit)
      const surplus = r.product_id ? (surplusByProduct.get(r.product_id) ?? 0) : 0
      return {
        product_id: r.product_id,
        // Null title = the product was hard-deleted and its order_items.product_id
        // went NULL (pre-fix orphans; the zombie-cleanup no longer deletes sold
        // products). No title/SKU is stored on order_items, so the identity is
        // unrecoverable — label it plainly rather than the cryptic "Unknown".
        title: r.title ?? 'Удалённый товар',
        sku: r.sku ?? null,
        // NULL variant_group_key propagates through — the client's grouping
        // treats NULL as "don't group", so an orphan row lands as a flat
        // "Удалённый товар" row without ever getting absorbed into a group
        // and without erroring out on the union-find lookup.
        variant_group_key: r.variant_group_key ?? null,
        variant_color: r.variant_color ?? null,
        marketplace: r.marketplace ?? null,
        // Sold = delivered units: DB non-cancelled minus those still in transit.
        qty_sold: Math.max(Number(r.qty_sold) - dbInTransit, 0),
        qty_in_transit: dbInTransit + surplus,
        qty_cancelled: Number(r.qty_cancelled),
        qty_returned: Number(r.qty_returned),
        revenue: Number(r.revenue),
      }
    })
    return [...mapped, ...extraRows]
  },
  // Bump cache tag when the row shape changes so a redeploy with an
  // in-memory `unstable_cache` doesn't serve v6 rows missing the two
  // new variant fields.
  ['product-sales-v10'],
  { revalidate: 30, tags: ['product-data'] },
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
  name_ru?: string
  name_uz?: string
  name_en?: string
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
      // The category donut is a "Доля продаж" (share-of-sales) DISTRIBUTION, not
      // the earned-revenue headline — so it counts real sales activity: every
      // order that isn't cancelled or returned, INCLUDING still-in-transit
      // (pending/confirmed). This matches the daily-revenue chart's basis, so a
      // seller whose orders haven't been delivered yet still sees which
      // categories they sell instead of a blank "Нет данных". The accrual
      // headline KPIs (Общая выручка, Чистая прибыль) and the P&L stay
      // delivered-only; only this distribution view widened.
      sql`${orders.status} not in ('cancelled','returned')`,
    ]
    if (sinceDate) conditions.push(gte(orders.ordered_at, sinceDate))
    if (untilDate) conditions.push(lte(orders.ordered_at, untilDate))

    // Canonical grouping needs migration 031's category_aliases +
    // categories_canonical. If those tables aren't present yet (deploy where
    // apply-sql-migrations.mjs didn't run to completion), fall back to raw
    // per-marketplace category grouping so the dashboard still renders.
    const merged = new Map<string, { name: string; name_ru?: string; name_uz?: string; name_en?: string; revenue: number; profit: number }>()
    try {
      const rows = await db.select({
        raw_category: sql<string>`coalesce(${products.category}, 'Uncategorized')`.as('raw_category'),
        canonical_id: categoriesCanonical.id,
        canonical_ru: categoriesCanonical.name_ru,
        canonical_uz: categoriesCanonical.name_uz,
        canonical_en: categoriesCanonical.name_en,
        revenue: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price_per_unit}), 0)`.as('revenue'),
        profit: sql<number>`coalesce(sum(${orderItems.quantity} * (${orderItems.price_per_unit} - coalesce(${orderItems.cost_per_unit}, ${products.cost_price}, 0))), 0)`.as('profit'),
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .innerJoin(products, eq(orderItems.product_id, products.id))
        .leftJoin(categoryAliases, and(
          eq(products.category, categoryAliases.original_name),
          sql`${categoryAliases.marketplace} = ${orders.marketplace}::text`,
        ))
        .leftJoin(categoriesCanonical, eq(categoryAliases.canonical_id, categoriesCanonical.id))
        .where(and(...conditions))
        .groupBy(
          sql`coalesce(${categoriesCanonical.id}::text, ${products.category})`,
          categoriesCanonical.id,
          categoriesCanonical.name_ru,
          categoriesCanonical.name_uz,
          categoriesCanonical.name_en,
          // Selected via `raw_category = coalesce(products.category, ...)`.
          // Postgres doesn't infer functional dependency from "column appears
          // inside a grouping expression", so the raw column needs to be its
          // own term. The merged-map layer below still dedupes rows sharing a
          // canonical id, so per-marketplace splits don't survive to the UI.
          products.category,
        )

      for (const r of rows) {
        const key = r.canonical_id != null ? `c:${r.canonical_id}` : r.raw_category
        const existing = merged.get(key)
        if (existing) {
          existing.revenue += Number(r.revenue)
          existing.profit += Number(r.profit)
        } else {
          merged.set(key, {
            name: r.canonical_ru ?? r.raw_category,
            name_ru: r.canonical_ru ?? undefined,
            name_uz: r.canonical_uz ?? undefined,
            name_en: r.canonical_en ?? undefined,
            revenue: Number(r.revenue),
            profit: Number(r.profit),
          })
        }
      }
    } catch (err) {
      console.warn('[getCategoryRevenue] canonical query failed, falling back to raw category grouping', err)
      const rows = await db.select({
        raw_category: sql<string>`coalesce(${products.category}, 'Uncategorized')`.as('raw_category'),
        revenue: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price_per_unit}), 0)`.as('revenue'),
        profit: sql<number>`coalesce(sum(${orderItems.quantity} * (${orderItems.price_per_unit} - coalesce(${orderItems.cost_per_unit}, ${products.cost_price}, 0))), 0)`.as('profit'),
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .innerJoin(products, eq(orderItems.product_id, products.id))
        .where(and(...conditions))
        .groupBy(products.category)

      for (const r of rows) {
        merged.set(r.raw_category, {
          name: r.raw_category,
          revenue: Number(r.revenue),
          profit: Number(r.profit),
        })
      }
    }

    const results = Array.from(merged.values())
    const totalRevenue = results.reduce((s, r) => s + r.revenue, 0)
    return results.map(r => ({
      name: r.name,
      name_ru: r.name_ru,
      name_uz: r.name_uz,
      name_en: r.name_en,
      revenue: r.revenue,
      profit: r.profit,
      // Full-precision share; the label rounds for display (to 1 dp) so the
      // shown figures still sum to ~100. Don't round here or the decimals are lost.
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }))
  },
  ['category-revenue-rpc-v2'],
  { revalidate: 30, tags: ['product-data'] },
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
  async (userId: string, marketplace: string | null, page: number, pageSize: number, archived: boolean): Promise<PaginatedProducts> => {
    const offset = (page - 1) * pageSize

    const shopConditions = [
      eq(shops.user_id, userId),
      or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO')),
    ]
    if (marketplace) shopConditions.push(eq(shops.marketplace, marketplace as MarketplaceType))

    const userShops = await db.select({ id: shops.id, marketplace: shops.marketplace, warehouse_id: shops.warehouse_id })
      .from(shops).where(and(...shopConditions))
    const shopIds = userShops.map(s => s.id)
    if (shopIds.length === 0) return { rows: [], total: 0, archivedTotal: 0 }

    const shopInfo = new Map<string, { marketplace: MarketplaceType; warehouseId: string | null }>()
    for (const s of userShops) {
      shopInfo.set(s.id, { marketplace: s.marketplace as MarketplaceType, warehouseId: s.warehouse_id })
    }

    // Current view filters on the requested archived state; the badge count
    // always reflects archived rows regardless of which view is open.
    const viewWhere = and(inArray(products.shop_id, shopIds), eq(products.is_archived, archived))
    const archivedWhere = and(inArray(products.shop_id, shopIds), eq(products.is_archived, true))

    const [productRows, [{ total }], [{ archivedTotal }]] = await Promise.all([
      db.select({
        id: products.id,
        shop_id: products.shop_id,
        sku: products.sku,
        title: products.title,
        cost_price: products.cost_price,
        selling_price: products.selling_price,
        stock_quantity: products.stock_quantity,
        quantity_sold: products.quantity_sold,
        category: products.category,
        marketplace_product_id: products.marketplace_product_id,
        fulfillment_type: products.fulfillment_type,
        is_archived: products.is_archived,
        variant_group_key: products.variant_group_key,
        variant_color: products.variant_color,
        updated_at: products.updated_at,
      }).from(products)
        .where(viewWhere)
        .orderBy(asc(products.title))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(products).where(viewWhere),
      db.select({ archivedTotal: count() }).from(products).where(archivedWhere),
    ])

    const productIds = productRows.map(p => p.id)
    const soldRows = productIds.length > 0
      ? await db.select({
          product_id: orderItems.product_id,
          qty_sold: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.as('qty_sold'),
          qty_in_transit: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} in ('pending','confirmed')), 0)`.as('qty_in_transit'),
          qty_cancelled: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'cancelled'), 0)`.as('qty_cancelled'),
        }).from(orderItems)
          .innerJoin(orders, eq(orderItems.order_id, orders.id))
          .where(inArray(orderItems.product_id, productIds))
          .groupBy(orderItems.product_id)
      : []

    const soldMap = new Map<string, number>()
    const inTransitMap = new Map<string, number>()
    const cancelledMap = new Map<string, number>()
    for (const r of soldRows) {
      if (r.product_id) {
        soldMap.set(r.product_id, Number(r.qty_sold))
        inTransitMap.set(r.product_id, Number(r.qty_in_transit))
        cancelledMap.set(r.product_id, Number(r.qty_cancelled))
      }
    }

    const groupShopCount = new Map<string, number>()
    const groupMaxStock = new Map<string, number>()
    const groupTotalPending = new Map<string, number>()
    // Same shape as _fetchProducts / lib/db/stock-groups.ts.
    const groupFbsMax = new Map<string, number>()
    const groupFboSum = new Map<string, number>()
    for (const p of productRows) {
      if (!p.sku) continue
      const key = p.sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
      groupShopCount.set(key, (groupShopCount.get(key) ?? 0) + 1)
      groupMaxStock.set(key, Math.max(groupMaxStock.get(key) ?? 0, p.stock_quantity))
      const isFbs = p.fulfillment_type === 'fbs' || p.fulfillment_type === null
      if (isFbs) {
        groupFbsMax.set(key, Math.max(groupFbsMax.get(key) ?? 0, p.stock_quantity))
        groupTotalPending.set(key, (groupTotalPending.get(key) ?? 0) + (inTransitMap.get(p.id) ?? 0))
      } else {
        groupFboSum.set(key, (groupFboSum.get(key) ?? 0) + p.stock_quantity)
      }
    }

    const rows: Product[] = productRows.map(p => {
      const orderSold = soldMap.get(p.id) ?? 0
      const sold = p.quantity_sold != null ? p.quantity_sold : orderSold
      const dbInTransit = inTransitMap.get(p.id) ?? 0
      const surplus = p.quantity_sold != null ? Math.max(p.quantity_sold - orderSold, 0) : 0
      const deliveredUnits = Math.max(orderSold - dbInTransit, 0)
      const key = p.sku ? p.sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '') : null
      const isShared = key ? (groupShopCount.get(key) ?? 0) > 1 : false
      const availableStock = Math.max(0, p.stock_quantity - dbInTransit)
      const totalPhysical = key
        ? (groupFbsMax.get(key) ?? 0) + (groupFboSum.get(key) ?? 0)
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
        fulfillment_type: p.fulfillment_type,
        updated_at: p.updated_at.toISOString(),
        marketplace: shopInfo.get(p.shop_id)?.marketplace,
        available_stock: availableStock,
        total_physical: totalPhysical,
        profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        delivered: deliveredUnits,
        in_transit: dbInTransit + surplus,
        cancelled: cancelledMap.get(p.id) ?? 0,
        is_shared: isShared,
        is_archived: p.is_archived,
        variant_group_key: p.variant_group_key,
        variant_color: p.variant_color,
      } as Product
    })

    return { rows, total, archivedTotal }
  },
  ['products-paginated-rpc-v4'],
  { revalidate: 30, tags: ['product-data'] },
)

export async function getProductsPaginated(page = 1, pageSize = 50, marketplace?: MarketplaceType, archived = false): Promise<PaginatedProducts> {
  const userId = await getCurrentUserId()
  if (!userId) return { rows: [], total: 0, archivedTotal: 0 }
  return _fetchProductsPaginated(userId, marketplace ?? null, page, pageSize, archived)
}
