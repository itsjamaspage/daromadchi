import { createClient } from '@/lib/supabase/server'
import { getShopIds } from '@/lib/db/shop-context'
import type { DailyRevenue, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getDailyRevenue(days = 7, marketplace?: MarketplaceType): Promise<DailyRevenue[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select('ordered_at, revenue')
    .in('shop_id', shopIds)
    .neq('status', 'cancelled')
    .gte('ordered_at', since.toISOString())
    .order('ordered_at', { ascending: true })

  if (error || !data) return []

  const grouped = new Map<string, { revenue: number; count: number }>()
  for (const row of data) {
    const date = row.ordered_at.slice(0, 10)
    const existing = grouped.get(date) ?? { revenue: 0, count: 0 }
    grouped.set(date, { revenue: existing.revenue + Number(row.revenue ?? 0), count: existing.count + 1 })
  }

  return Array.from(grouped.entries()).map(([date, v]) => ({
    date: new Date(date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
    revenue: v.revenue,
    order_count: v.count,
  }))
}
