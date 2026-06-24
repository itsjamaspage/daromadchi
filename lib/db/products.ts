import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// Cached per (userId, marketplace) for 30 s. Runs 3 queries in parallel —
// products, sku map, and sold counts via orders join — no serial waterfall.
const _fetchProducts = unstable_cache(
  async (userId: string, mp: string): Promise<Product[]> => {
    const supabase = createAdminClient()
    const { data: shopsData } = await supabase.from('shops').select('id, marketplace').eq('user_id', userId)
    const allShops = shopsData ?? []
    if (allShops.length === 0) return []

    const allShopIds = allShops.map((s: { id: string }) => s.id)
    const targetShopIds = mp
      ? allShops.filter((s: { marketplace: string }) => s.marketplace === mp).map((s: { id: string }) => s.id)
      : allShopIds
    if (targetShopIds.length === 0) return []

    const shopFilter = `(${allShopIds.join(',')})`
    const [
      { data: products, error },
      { data: allUserProducts },
      { data: soldItems },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id, shop_id, sku, title, cost_price, selling_price, stock_quantity, physical_stock, category, marketplace_product_id, updated_at')
        .in('shop_id', targetShopIds)
        .order('title'),
      supabase
        .from('products')
        .select('id, sku')
        .in('shop_id', allShopIds),
      // Join order_items → orders in one query instead of the old 2-step pattern
      // (get validOrderIds → get items). Filters by shop & status via !inner join.
      supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(shop_id, status)')
        .filter('orders.shop_id', 'in', shopFilter)
        .filter('orders.status', 'in', '(pending,confirmed,delivered)'),
    ])
    if (error || !products) return []

    const productSkuMap = new Map((allUserProducts ?? []).map((p: { id: string; sku: string | null }) => [p.id, p.sku]))
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
      const skuSold = p.sku ? (soldBySku.get(p.sku) ?? 0) : sold
      const hasSharedPool = p.physical_stock !== null && p.sku !== null
      const available_stock = hasSharedPool
        ? Math.max(0, p.physical_stock! - skuSold)
        : p.stock_quantity

      return {
        ...p,
        physical_stock: p.physical_stock ?? null,
        available_stock,
        profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
        sold,
        is_shared: hasSharedPool,
      }
    })
  },
  ['products'],
  { revalidate: 30 },
)

export async function getProducts(marketplace?: MarketplaceType): Promise<Product[]> {
  if (!supabaseConfigured) return []
  const userId = await getCurrentUserId()
  if (!userId) return []
  return _fetchProducts(userId, marketplace ?? '')
}

export interface ProductSalesRow {
  product_id: string
  title: string
  sku: string | null
  qty_sold: number
  revenue: number
}

// Cached per (userId, marketplace, period) for 30 s. Collapses the old two-step
// orders→order_items serial waterfall into a single join query.
const _fetchProductSales = unstable_cache(
  async (userId: string, mp: string, days: number | null, from: string, to: string): Promise<ProductSalesRow[]> => {
    const supabase = createAdminClient()
    const { data: shopsData } = await supabase.from('shops').select('id, marketplace').eq('user_id', userId)
    const allShops = shopsData ?? []
    const shopIds = mp
      ? allShops.filter((s: { marketplace: string }) => s.marketplace === mp).map((s: { id: string }) => s.id)
      : allShops.map((s: { id: string }) => s.id)
    if (shopIds.length === 0) return []

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
  const userId = await getCurrentUserId()
  if (!userId) return []
  return _fetchProductSales(userId, marketplace ?? '', days, from ?? '', to ?? '')
}
