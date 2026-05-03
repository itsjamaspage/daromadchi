import { createClient } from '@/lib/supabase/server'
import { products as mockProducts } from '@/lib/mock-data'
import type { Product } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getProducts(): Promise<Product[]> {
  if (!supabaseConfigured) {
    return mockProducts.map(p => ({ ...p, user_id: 'mock', created_at: '', profit: p.profit }))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Enrich with sold count from orders
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, user_id, name, sku, category, price, cost, stock, created_at,
      orders (amount)
    `)
    .eq('user_id', user.id)
    .order('name')

  if (error || !data) return []

  return data.map(p => {
    const orders = (p.orders ?? []) as { amount: number }[]
    return {
      ...p,
      orders: undefined,
      profit: p.price - p.cost,
      sold: orders.length,
    }
  })
}
