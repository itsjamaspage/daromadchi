import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId, getUserShops } from '@/lib/db/shop-context'
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

  // Fetch target products
  const { data: products, error } = await supabase
    .from('products')
    .select('id, shop_id, sku, title, cost_price, selling_price, stock_quantity, physical_stock, category, marketplace_product_id, updated_at')
    .in('shop_id', targetShopIds)
    .order('title')
  if (error || !products) return []

  // Build sold counts from order_items across ALL user shops
  // This fixes the sold=0 bug and enables cross-marketplace shared inventory.
  const { data: allUserProducts } = await supabase
    .from('products')
    .select('id, sku')
    .in('shop_id', allShopIds)

  const productSkuMap = new Map((allUserProducts ?? []).map(p => [p.id, p.sku as string | null]))
  const allProductIds = (allUserProducts ?? []).map(p => p.id)

  const soldByProductId = new Map<string, number>()
  const soldBySku = new Map<string, number>()

  if (allProductIds.length > 0) {
    // Valid (non-cancelled, non-returned) order IDs for this user
    const { data: validOrders } = await supabase
      .from('orders')
      .select('id')
      .in('shop_id', allShopIds)
      .in('status', ['pending', 'confirmed', 'delivered'])

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
