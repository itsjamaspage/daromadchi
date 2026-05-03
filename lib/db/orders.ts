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
      id: o.id as unknown as number,
      user_id: 'mock',
      order_ref: o.id,
      customer: o.customer,
      product_name: o.product,
      amount: o.amount,
      status: o.status as Order['status'],
      ordered_at: o.date,
      created_at: '',
    }))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('orders')
    .select('id, user_id, order_ref, customer, product_name, amount, status, ordered_at, created_at')
    .eq('user_id', user.id)
    .order('ordered_at', { ascending: false })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error || !data) return []

  return data
}
