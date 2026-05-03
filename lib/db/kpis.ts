import { createClient } from '@/lib/supabase/server'
import { kpiData, orders as mockOrders, products as mockProducts } from '@/lib/mock-data'
import type { Kpis } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getKpis(days = 30): Promise<Kpis> {
  if (!supabaseConfigured) {
    // Scale mock values by day range so the filter visibly changes numbers
    const scale = days === 7 ? 0.25 : days === 30 ? 1 : days === 90 ? 2.8 : 1
    const filtered = mockOrders.filter(o => o.status !== 'cancelled')
    return {
      total_revenue: Math.round(kpiData.revenue.value * scale),
      total_profit:  Math.round(kpiData.profit.value  * scale),
      total_orders:  Math.round(filtered.length * scale),
      total_stock:   mockProducts.reduce((s, p) => s + p.stock, 0),
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const sinceStr = since.toISOString().slice(0, 10)

  const [ordersRes, stockRes] = await Promise.all([
    supabase
      .from('orders')
      .select('amount, products(cost)')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('ordered_at', sinceStr),
    supabase
      .from('products')
      .select('stock')
      .eq('user_id', user.id),
  ])

  const orderRows = ordersRes.data ?? []
  const total_revenue = orderRows.reduce((s, o) => s + Number(o.amount), 0)
  const total_profit  = orderRows.reduce((s, o) => {
    const cost = (o.products as any)?.cost ?? 0
    return s + Number(o.amount) - Number(cost)
  }, 0)
  const total_orders = orderRows.length
  const total_stock  = (stockRes.data ?? []).reduce((s, p) => s + p.stock, 0)

  return { total_revenue, total_profit, total_orders, total_stock }
}
