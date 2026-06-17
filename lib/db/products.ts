import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId, getUserShops, getShopIds } from '@/lib/db/shop-context'
import type { Product, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getProducts(marketplace?: MarketplaceType): Promise<Product[]> {
  if (!supabaseConfigured) return []

  const userId = await getCurrentUserId()
  if (!userId) return []

  // All shops for this user (needed for cross-marketplace sold computation).
  // Shared, request-memoized — no extra auth or shops round-trip here.
  const allShops = await getUserShops()
  if (allShops.length === 0) return []

  const supabase = await createClient()
  const allShopIds = allShops.map(s => s.id)
  const targetShopIds = marketplace
    ? allShops.filter(s => s.marketplace === marketplace).map(s => s.id)
    : allShopIds
  if (targetShopIds.length === 0) return []

  // These three queries are independent of each other — run them in parallel:
  //  • target products (the rows we return)
  //  • all user products (for SKU mapping across marketplaces)
  //  • valid order IDs (to attribute sold counts)
  const [
    { data: products, error },
    { data: allUserProducts },
    { data: validOrders },
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
    supabase
      .from('orders')
      .select('id')
      .in('shop_id', allShopIds)
      .in('status', ['pending', 'confirmed', 'delivered']),
  ])
  if (error || !products) return []

  // Build sold counts from order_items across ALL user shops
  // This fixes the sold=0 bug and enables cross-marketplace shared inventory.
  const productSkuMap = new Map((allUserProducts ?? []).map(p => [p.id, p.sku as string | null]))
  const allProductIds = (allUserProducts ?? []).map(p => p.id)

  const soldByProductId = new Map<string, number>()
  const soldBySku = new Map<string, number>()

  if (allProductIds.length > 0) {
    const validOrderIds = (validOrders ?? []).map(o => o.id)

    if (validOrderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .in('order_id', validOrderIds)

      for (const item of items ?? []) {
        if (!item.product_id) continue
        soldByProductId.set(item.product_id, (soldByProductId.get(item.product_id) ?? 0) + item.quantity)
        const sku = productSkuMap.get(item.product_id)
        if (sku) soldBySku.set(sku, (soldBySku.get(sku) ?? 0) + item.quantity)
      }
    }
  }

  return products.map(p => {
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
}

export interface ProductSalesRow {
  product_id: string
  title: string
  sku: string | null
  qty_sold: number
  revenue: number
}

// Period-bound per-product sales: joins order_items → orders filtered by
// ordered_at within the window. Does NOT touch the lifetime `sold` field
// in getProducts() — stock math stays intact.
export async function getProductSales(
  days: number | null,      // null = all-time; > 0 = last N days
  marketplace?: MarketplaceType,
  from?: string,            // "YYYY-MM-DD" custom start, overrides days
  to?: string,              // "YYYY-MM-DD" custom end (inclusive)
): Promise<ProductSalesRow[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []

  const supabase = await createClient()

  // Resolve the date window
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

  let ordersQuery = supabase
    .from('orders')
    .select('id')
    .in('shop_id', shopIds)
    .neq('status', 'cancelled')
  if (sinceIso) ordersQuery = ordersQuery.gte('ordered_at', sinceIso)
  if (untilIso) ordersQuery = ordersQuery.lte('ordered_at', untilIso)

  const { data: ordersInWindow } = await ordersQuery
  if (!ordersInWindow || ordersInWindow.length === 0) return []

  const orderIds = ordersInWindow.map(o => o.id)

  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, quantity, price_per_unit, products(title, sku)')
    .in('order_id', orderIds)
    .not('product_id', 'is', null)

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
}
