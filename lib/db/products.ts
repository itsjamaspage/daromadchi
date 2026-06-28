import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopIds } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// allShopIdsStr  — all shops for this user (for cross-marketplace SKU dedup + sold counts)
// targetShopIdsStr — shops filtered by marketplace (for the main products query)
const _fetchProducts = unstable_cache(
  async (allShopIdsStr: string, targetShopIdsStr: string): Promise<Product[]> => {
    const allShopIds    = allShopIdsStr    ? allShopIdsStr.split(',')    : []
    const targetShopIds = targetShopIdsStr ? targetShopIdsStr.split(',') : []
    if (allShopIds.length === 0 || targetShopIds.length === 0) return []

    const supabase = createAdminClient()
    const shopFilter = `(${allShopIds.join(',')})`

    const [
      { data: products, error },
      { data: allUserProducts },
      { data: soldItems },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id, shop_id, sku, title, cost_price, selling_price, stock_quantity, category, marketplace_product_id, updated_at')
        .in('shop_id', targetShopIds)
        .order('title'),
      supabase
        .from('products')
        .select('id, sku')
        .in('shop_id', allShopIds),
      supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(shop_id)')
        .filter('orders.shop_id', 'in', shopFilter),
    ])
    if (error || !products) return []

    const productSkuMap = new Map<string, string | null>((allUserProducts ?? []).map((p: { id: string; sku: string | null }) => [p.id, p.sku] as [string, string | null]))
    const soldByProductId = new Map<string, number>()
    const soldBySku = new Map<string, number>()

    for (const item of soldItems ?? []) {
      if (!item.product_id) continue
      soldByProductId.set(item.product_id, (soldByProductId.get(item.product_id) ?? 0) + item.quantity)
      const sku = productSkuMap.get(item.product_id)
      if (sku) soldBySku.set(sku, (soldBySku.get(sku) ?? 0) + item.quantity)
    }

    return products.map((p: any) => {
      const sold = soldByProductId.get(p.id) ?? 0

      return {
        ...p,
        available_stock: p.stock_quantity,
        profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        is_shared: false,
      }
    })
  },
  ['products'],
  { revalidate: 30 },
)

export async function getProducts(marketplace?: MarketplaceType): Promise<Product[]> {
  if (!supabaseConfigured) return []
  const [allShopIds, targetShopIds] = await Promise.all([
    getShopIds(),
    marketplace ? getShopIds(marketplace) : getShopIds(),
  ])
  if (!allShopIds || allShopIds.length === 0) return []
  if (!targetShopIds || targetShopIds.length === 0) return []
  return _fetchProducts(allShopIds.join(','), targetShopIds.join(','))
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

    const shopFilter = `(${shopIds.join(',')})`
    let query = supabase
      .from('order_items')
      .select('product_id, quantity, price_per_unit, orders!inner(shop_id, status, ordered_at), products(title, sku)')
      .filter('orders.shop_id', 'in', shopFilter)
      .filter('orders.status', 'neq', 'cancelled')
      .not('product_id', 'is', null)
    if (sinceIso) query = query.filter('orders.ordered_at', 'gte', sinceIso)
    if (untilIso) query = query.filter('orders.ordered_at', 'lte', untilIso)

    const { data: items } = await query
    if (!items || items.length === 0) return []

    const byProduct = new Map<string, ProductSalesRow>()
    for (const item of items) {
      if (!item.product_id) continue
      const prod = Array.isArray(item.products) ? item.products[0] : item.products
      const existing = byProduct.get(item.product_id)
      if (existing) {
        existing.qty_sold += item.quantity ?? 0
        existing.revenue  += (item.quantity ?? 0) * (item.price_per_unit ?? 0)
      } else {
        byProduct.set(item.product_id, {
          product_id: item.product_id,
          title:      prod?.title ?? 'Unknown',
          sku:        prod?.sku   ?? null,
          qty_sold:   item.quantity ?? 0,
          revenue:    (item.quantity ?? 0) * (item.price_per_unit ?? 0),
        })
      }
    }

    return [...byProduct.values()].sort((a, b) => b.qty_sold - a.qty_sold)
  },
  ['product-sales'],
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

    const { data: rows, error } = await supabase.rpc('get_category_revenue', {
      shop_ids: shopIds,
      since_iso: sinceIso,
      until_iso: untilIso,
    })
    if (error || !rows || rows.length === 0) return []

    const total = rows.reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0)
    return rows.map((r: any) => ({
      name: r.category,
      revenue: Number(r.revenue ?? 0),
      profit: Number(r.revenue ?? 0) - Number(r.cost ?? 0),
      percent: total > 0 ? (Number(r.revenue ?? 0) / total) * 100 : 0,
    }))
  },
  ['category-revenue-v3'],
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
