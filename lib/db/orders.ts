import { createClient } from '@/lib/supabase/server'
import { orders as mockOrders } from '@/lib/mock-data'
import type { Order } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getOrders(limit?: number): Promise<Order[]> {
  if (!supabaseConfigured) {
    const rows = limit ? mockOrders.slice(0, limit) : mockOrders
    return rows.map(o => ({
      id: String(o.id),
      shop_id: 'mock',
      order_id_external: o.id,
      marketplace: 'uzum' as const,
      status: 'delivered' as const,
      revenue: o.amount,
      marketplace_fee: null,
      delivery_cost: null,
      items_count: 1,
      ordered_at: o.date,
    }))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('orders')
    .select('id, shop_id, order_id_external, marketplace, status, revenue, marketplace_fee, delivery_cost, items_count, ordered_at')
    .order('ordered_at', { ascending: false })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error || !data) return []
  return data
}
