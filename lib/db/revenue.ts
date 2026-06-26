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
    let untilIso: string | undefined

    if (from) {
      sinceIso = new Date(from).toISOString()
      untilIso = to ? new Date(to + 'T23:59:59').toISOString() : undefined
    } else {
      const since = new Date()
      since.setDate(since.getDate() - days + 1)
      sinceIso = since.toISOString()
    }

    let q = supabase
      .from('orders')
      .select('ordered_at, revenue')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('ordered_at', sinceIso)
      .order('ordered_at', { ascending: true })

    if (untilIso) q = q.lte('ordered_at', untilIso)

    const { data, error } = await q
    if (error || !data) return []

    const grouped = new Map<string, { revenue: number; count: number }>()
    for (const row of data) {
      const date = row.ordered_at.slice(0, 10)
      const existing = grouped.get(date) ?? { revenue: 0, count: 0 }
      grouped.set(date, { revenue: existing.revenue + Number(row.revenue ?? 0), count: existing.count + 1 })
    }

    return Array.from(grouped.entries()).map(([date, v]) => {
      const d = new Date(date)
      const label = d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })
      return {
        date: `${label} ${d.getFullYear()}`,
        revenue: v.revenue,
        order_count: v.count,
      }
    })
  },
  ['revenue'],
  { revalidate: 1 },
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
