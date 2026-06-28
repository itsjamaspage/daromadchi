import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopIds } from '@/lib/db/shop-context'
import type { Order, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

const _fetchOrders = unstable_cache(
  async (shopIdsStr: string, limit: number, from: string, to: string): Promise<Order[]> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return []

    const supabase = createAdminClient()
    let query = supabase
      .from('orders')
      .select('id, shop_id, order_id_external, marketplace, status, revenue, marketplace_fee, delivery_cost, items_count, ordered_at')
      .in('shop_id', shopIds)
      .order('ordered_at', { ascending: false })

    if (from && to) {
      const sinceIso = new Date(from).toISOString()
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
      query = query.gte('ordered_at', sinceIso).lte('ordered_at', toDate.toISOString())
    }
    if (limit > 0) query = query.limit(limit)

    const { data, error } = await query
    if (error || !data) return []
    return data
  },
  ['orders'],
  { revalidate: 30 },
)

export async function getOrders(limit?: number, marketplace?: MarketplaceType, from?: string, to?: string): Promise<Order[]> {
  if (!supabaseConfigured) return []
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchOrders(shopIds.join(','), limit ?? 0, from ?? '', to ?? '')
}
