import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { Order, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

const _fetchOrders = unstable_cache(
  async (userId: string, mp: string, limit: number): Promise<Order[]> => {
    const supabase = await createClient()
    const { data: shopsData } = await supabase.from('shops').select('id, marketplace').eq('user_id', userId)
    const allShops = shopsData ?? []
    const shopIds = mp
      ? allShops.filter((s: { marketplace: string }) => s.marketplace === mp).map((s: { id: string }) => s.id)
      : allShops.map((s: { id: string }) => s.id)
    if (shopIds.length === 0) return []

    let query = supabase
      .from('orders')
      .select('id, shop_id, order_id_external, marketplace, status, revenue, marketplace_fee, delivery_cost, items_count, ordered_at')
      .in('shop_id', shopIds)
      .order('ordered_at', { ascending: false })

    if (limit > 0) query = query.limit(limit)

    const { data, error } = await query
    if (error || !data) return []
    return data
  },
  ['orders'],
  { revalidate: 30 },
)

export async function getOrders(limit?: number, marketplace?: MarketplaceType): Promise<Order[]> {
  if (!supabaseConfigured) return []
  const userId = await getCurrentUserId()
  if (!userId) return []
  return _fetchOrders(userId, marketplace ?? '', limit ?? 0)
}
