import { createClient } from '@/lib/supabase/server'
import { kpiData, orders as mockOrders, products as mockProducts } from '@/lib/mock-data'
import type { Kpis, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

async function getShopIds(marketplace?: MarketplaceType): Promise<string[] | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  let q = supabase.from('shops').select('id').eq('user_id', user.id)
  if (marketplace) q = q.eq('marketplace', marketplace)
  const { data } = await q
  return (data ?? []).map((s: { id: string }) => s.id)
}

export async function getKpis(days = 30, marketplace?: MarketplaceType): Promise<Kpis> {
  if (!supabaseConfigured) {
    const scale = days === 7 ? 0.25 : days === 30 ? 1 : days === 90 ? 2.8 : 1
    const filtered = mockOrders.filter(o => o.status !== 'cancelled')
    return {
      total_revenue: Math.round(kpiData.revenue.value * scale),
      total_profit:  Math.round(kpiData.profit.value  * scale),
      total_orders:  Math.round(filtered.length * scale),
      total_stock:   mockProducts.reduce((s, p) => s + p.stock, 0),
    }
  }

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) {
    return { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }
  }

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const supabase = await createClient()

  const [ordersRes, stockRes] = await Promise.all([
    supabase
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('ordered_at', since.toISOString()),
    supabase
      .from('products')
      .select('sku, stock_quantity, physical_stock')
      .in('shop_id', shopIds),
  ])

  const rows = ordersRes.data ?? []
  const total_revenue = rows.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
  const total_profit  = rows.reduce((s, o) =>
    s + Number(o.revenue ?? 0) - Number(o.marketplace_fee ?? 0) - Number(o.delivery_cost ?? 0), 0)
  const total_orders  = rows.length

  // Avoid double-counting shared inventory: for products with physical_stock set,
  // count the pool once per SKU instead of once per marketplace listing.
  const seenSkus = new Set<string>()
  let total_stock = 0
  for (const p of stockRes.data ?? []) {
    if (p.physical_stock !== null && p.sku) {
      if (!seenSkus.has(p.sku)) {
        seenSkus.add(p.sku)
        total_stock += p.physical_stock
      }
    } else {
      total_stock += p.stock_quantity
    }
  }

  return { total_revenue, total_profit, total_orders, total_stock }
}
