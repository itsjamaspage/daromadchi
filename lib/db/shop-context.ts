import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { MarketplaceType } from '@/lib/types'

// Per-request memoized shop lookup. React's cache() dedupes calls within a
// single server render, so when the dashboard fires getKpis/getOrders/
// getProducts/getDailyRevenue in parallel they share ONE auth.getUser() and
// ONE shops query instead of each running their own.
export const getShopIds = cache(
  async (marketplace?: MarketplaceType): Promise<string[] | null> => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    let q = supabase.from('shops').select('id').eq('user_id', user.id)
    if (marketplace) q = q.eq('marketplace', marketplace)
    const { data } = await q
    return (data ?? []).map((s: { id: string }) => s.id)
  },
)
