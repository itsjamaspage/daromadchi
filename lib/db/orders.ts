import { createClient } from '@/lib/supabase/server'
import type { Order, MarketplaceType } from '@/lib/types'

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

export async function getOrders(limit?: number, marketplace?: MarketplaceType): Promise<Order[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []

  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('id, shop_id, order_id_external, marketplace, status, revenue, marketplace_fee, delivery_cost, items_count, ordered_at')
    .in('shop_id', shopIds)
    .order('ordered_at', { ascending: false })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error || !data) return []
  return data
}
