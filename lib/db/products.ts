import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopIds } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// Bug fix: Supabase JS silently ignores .filter('joined_table.column', ...) on embedded resources.
// All cross-table filtering is now done via RPC (raw SQL) to ensure correct results.

// allShopIdsStr  — all shops for this user (for cross-marketplace SKU dedup + sold counts)
// targetShopIdsStr — shops filtered by marketplace (for the main products query)
const _fetchProducts = unstable_cache(
  async (allShopIdsStr: string, targetShopIdsStr: string): Promise<Product[]> => {
    const allShopIds    = allShopIdsStr    ? allShopIdsStr.split(',')    : []
    const targetShopIds = targetShopIdsStr ? targetShopIdsStr.split(',') : []
    if (allShopIds.length === 0 || targetShopIds.length === 0) return []

    const supabase = createAdminClient()

    const [
      { data: products, error },
      { data: soldRows },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id, shop_id, sku, title, cost_price, selling_price, stock_quantity, category, marketplace_product_id, updated_at')
        .in('shop_id', targetShopIds)
        .order('title'),
      // Use RPC instead of embedded filter — JS client silently ignores joined-table filters
      supabase.rpc('get_sold_counts', { shop_ids: allShopIds }),
    ])
    if (error || !products) return []

    const soldByProductId = new Map<string, number>()
    for (const row of soldRows ?? []) {
      if (row.product_id) soldByProductId.set(row.product_id, Number(row.qty_sold ?? 0))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return products.map((p: any) => ({
      ...p,
      available_stock: p.stock_quantity,
      profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
      sold: soldByProductId.get(p.id) ?? 0,
      is_shared: false,
    }))
  },
  ['products-v2'],
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

    const { data: rows, error } = await supabase.rpc('get_category_revenue', {
      shop_ids: shopIds,
      since_iso: sinceIso,
      until_iso: untilIso,
    })
    if (error || !rows || rows.length === 0) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = rows.reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      name:    r.category ?? 'Boshqa',
      revenue: Number(r.revenue ?? 0),
      profit:  Number(r.revenue ?? 0) - Number(r.cost ?? 0),
      percent: total > 0 ? (Number(r.revenue ?? 0) / total) * 100 : 0,
    }))
  },
  ['category-revenue-v8'],
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
