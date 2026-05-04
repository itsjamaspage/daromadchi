import { createClient } from '@/lib/supabase/server'
import { products as mockProducts } from '@/lib/mock-data'
import type { Product } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getProducts(): Promise<Product[]> {
  if (!supabaseConfigured) {
    return mockProducts.map(p => ({
      id: String(p.id),
      shop_id: 'mock',
      sku: p.sku,
      title: p.name,
      cost_price: p.cost,
      selling_price: p.price,
      stock_quantity: p.stock,
      category: p.category,
      marketplace_product_id: null,
      updated_at: '',
      profit: p.profit,
      sold: p.sold,
    }))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('products')
    .select('id, shop_id, sku, title, cost_price, selling_price, stock_quantity, category, marketplace_product_id, updated_at')
    .order('title')

  if (error || !data) return []

  return data.map(p => ({
    ...p,
    profit: Number(p.selling_price ?? 0) - Number(p.cost_price ?? 0),
    sold: 0,
  }))
}
