import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopIds } from '@/lib/db/shop-context'
import type { DailyRevenue, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

const _fetchRevenue = unstable_cache(
  async (shopIdsStr: string, days: number, from: string, to: string): Promise<DailyRevenue[]> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return []

    const supabase = createAdminClient()

    let sinceIso: string
    let untilIso: string | null = null

    if (from) {
      sinceIso = new Date(from).toISOString()
      untilIso = to ? new Date(to + 'T23:59:59').toISOString() : null
    } else {
      const since = new Date()
      since.setDate(since.getDate() - days + 1)
      sinceIso = since.toISOString()
    }

    const { data, error } = await supabase.rpc('get_daily_revenue', {
      p_shop_ids: shopIds,
      p_since: sinceIso,
      p_until: untilIso,
    })

    if (error || !data) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(row => {
      const d = new Date(row.day)
      const label = d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })
      return {
        date: `${label} ${d.getFullYear()}`,
        revenue: Number(row.revenue ?? 0),
        order_count: Number(row.order_count ?? 0),
      }
    })
  },
  ['revenue-rpc'],
  { revalidate: 30 },
)

export async function getDailyRevenue(
  days = 7,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<DailyRevenue[]> {
  if (!supabaseConfigured) return []
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []
  return _fetchRevenue(shopIds.join(','), days, from ?? '', to ?? '')
}
