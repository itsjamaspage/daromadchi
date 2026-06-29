import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopIds } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// Fetch all products for the user across all shops.
// Marketplace filtering is done in JS so the result is cached once and reused for all tab switches.
const _fetchProducts = unstable_cache(
  async (allShopIdsStr: string): Promise<Product[]> => {
    const allShopIds = allShopIdsStr ? allShopIdsStr.split(',') : []
    if (allShopIds.length === 0) return []

    const supabase = createAdminClient()

    const [
      { data: products, error },
      { data: soldRows },
      { data: shopRows },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id, shop_id, sku, title, cost_price, selling_price, stock_quantity, physical_stock, category, marketplace_product_id, updated_at')
        .in('shop_id', allShopIds)
        .order('title'),
      supabase.rpc('get_sold_counts', { shop_ids: allShopIds }),
      supabase.from('shops').select('id, marketplace').in('id', allShopIds),
    ])
    if (error || !products) return []

    const soldByProductId = new Map<string, number>()
    for (const row of soldRows ?? []) {
      if (row.product_id) soldByProductId.set(row.product_id, Number(row.qty_sold ?? 0))
    }

    const shopMarketplace = new Map<string, MarketplaceType>()
    for (const s of shopRows ?? []) {
      shopMarketplace.set(s.id, s.marketplace as MarketplaceType)
    }

    // Group by SKU: count shops selling it + sum sold across all of them
    const skuTotalSold = new Map<string, number>()
    const skuCount     = new Map<string, number>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of products as any[]) {
      if (!p.sku) continue
      const sold = soldByProductId.get(p.id) ?? 0
      skuTotalSold.set(p.sku, (skuTotalSold.get(p.sku) ?? 0) + sold)
      skuCount.set(p.sku,     (skuCount.get(p.sku)     ?? 0) + 1)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (products as any[]).map(p => {
      const sold      = soldByProductId.get(p.id) ?? 0
      const isShared  = p.sku ? (skuCount.get(p.sku) ?? 0) > 1 : false
      const totalSold = p.sku ? (skuTotalSold.get(p.sku) ?? sold) : sold

      // When physical_stock is set, available = shared pool − all cross-shop sales for this SKU
      const availableStock = isShared && p.physical_stock != null
        ? Math.max(0, p.physical_stock - totalSold)
        : p.stock_quantity

      return {
        ...p,
        marketplace:     shopMarketplace.get(p.shop_id),
        available_stock: availableStock,
        profit:          Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        is_shared:       isShared,
      }
    })
  },
  ['products-v3'],
  { revalidate: 30 },
)

export async function getProducts(marketplace?: MarketplaceType): Promise<Product[]> {
  if (!supabaseConfigured) return []
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

    const supabase = createAdminClient()

    let sinceIso: string | null = null
    let untilIso: string | null = null
    if (from && to) {
      sinceIso = new Date(from).toISOString()
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
      untilIso = toDate.toISOString()
    } else if (days !== null && days > 0) {
      const d = new Date(); d.setDate(d.getDate() - days)
      sinceIso = d.toISOString()
    }

    // Use RPC — embedded .filter('orders.column', ...) is silently ignored by Supabase JS
    const { data: rows } = await supabase.rpc('get_product_sales', {
      shop_ids: shopIds,
      since_iso: sinceIso,
      until_iso: untilIso,
    })
    if (!rows || rows.length === 0) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      product_id: r.product_id,
      title:      r.title ?? 'Unknown',
      sku:        r.sku ?? null,
      qty_sold:   Number(r.qty_sold ?? 0),
      revenue:    Number(r.revenue ?? 0),
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
  if (!supabaseConfigured) return []
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

    const supabase = createAdminClient()

    let sinceIso: string | null = null
    let untilIso: string | null = null
    if (from && to) {
      sinceIso = new Date(from).toISOString()
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
      untilIso = toDate.toISOString()
    } else if (days > 0) {
      const d = new Date(); d.setDate(d.getDate() - days + 1)
      sinceIso = d.toISOString()
    }

    // Step 1: get qualifying order IDs by filtering on direct columns (orders.shop_id,
    // orders.ordered_at) — avoids the Supabase JS embedded-filter bug that the old RPC
    // worked around, but the RPC itself returned 0 rows for small shop-id subsets.
    let orderQuery = supabase.from('orders').select('id').in('shop_id', shopIds)
    if (sinceIso) orderQuery = orderQuery.gte('ordered_at', sinceIso)
    if (untilIso) orderQuery = orderQuery.lte('ordered_at', untilIso)
    const { data: orderRows, error: orderErr } = await orderQuery
    if (orderErr || !orderRows?.length) return []

    const orderIds = (orderRows as { id: string }[]).map(r => r.id)

    // Step 2: fetch items for those orders + product category via FK join.
    // Filter is on order_items.order_id (direct column) — no embedded-filter issue.
    const { data: items, error: itemErr } = await supabase
      .from('order_items')
      .select('price_per_unit, quantity, cost_per_unit, products(category)')
      .in('order_id', orderIds)
    if (itemErr || !items?.length) return []

    // Step 3: aggregate by category in JS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catMap = new Map<string, { revenue: number; cost: number }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of items as any[]) {
      const cat: string = item.products?.category ?? 'Boshqa'
      const rev = Number(item.price_per_unit) * Number(item.quantity)
      const cst = Number(item.cost_per_unit) * Number(item.quantity)
      const cur = catMap.get(cat) ?? { revenue: 0, cost: 0 }
      catMap.set(cat, { revenue: cur.revenue + rev, cost: cur.cost + cst })
    }

    const entries = [...catMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
    const total = entries.reduce((s, [, v]) => s + v.revenue, 0)
    return entries.map(([name, { revenue, cost }]) => ({
      name,
      revenue: Math.round(revenue),
      profit:  Math.round(revenue - cost),
      percent: total > 0 ? (revenue / total) * 100 : 0,
    }))
  },
  ['category-revenue-v9'],
  { revalidate: 30 },
)

export async function getCategoryRevenue(
  days: number,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<CategoryRow[]> {
  if (!supabaseConfigured) return []
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchCategoryRevenue(shopIds.join(','), days, from ?? '', to ?? '')
}
