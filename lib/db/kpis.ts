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

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

export async function getKpis(days = 30, marketplace?: MarketplaceType): Promise<Kpis> {
  if (!supabaseConfigured) {
    const scale = days === 7 ? 0.25 : days === 30 ? 1 : days === 90 ? 2.8 : 1
    const prevScale = scale * 0.88
    const filtered = mockOrders.filter(o => o.status !== 'cancelled')
    const curr_rev = Math.round(kpiData.revenue.value * scale)
    const curr_pro = Math.round(kpiData.profit.value  * scale)
    const curr_ord = Math.round(filtered.length * scale)
    const prev_rev = Math.round(kpiData.revenue.value * prevScale)
    const prev_pro = Math.round(kpiData.profit.value  * prevScale)
    const prev_ord = Math.round(filtered.length * prevScale)
    return {
      total_revenue: curr_rev, total_profit: curr_pro, total_orders: curr_ord,
      total_stock:   mockProducts.reduce((s, p) => s + p.stock, 0),
      change_revenue: pct(curr_rev, prev_rev),
      change_profit:  pct(curr_pro, prev_pro),
      change_orders:  pct(curr_ord, prev_ord),
    }
  }

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) {
    return { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }
  }

  const now = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - days + 1)
  const prevSince = new Date(since)
  prevSince.setDate(prevSince.getDate() - days)
  const supabase = await createClient()

  const [ordersRes, prevOrdersRes, stockRes] = await Promise.all([
    supabase
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('ordered_at', since.toISOString()),
    supabase
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('ordered_at', prevSince.toISOString())
      .lt('ordered_at', since.toISOString()),
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

  const prevRows = prevOrdersRes.data ?? []
  const prev_revenue = prevRows.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
  const prev_profit  = prevRows.reduce((s, o) =>
    s + Number(o.revenue ?? 0) - Number(o.marketplace_fee ?? 0) - Number(o.delivery_cost ?? 0), 0)
  const prev_orders  = prevRows.length

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

  return {
    total_revenue, total_profit, total_orders, total_stock,
    change_revenue: pct(total_revenue, prev_revenue),
    change_profit:  pct(total_profit,  prev_profit),
    change_orders:  pct(total_orders,  prev_orders),
  }
}
