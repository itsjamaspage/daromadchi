import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopIds } from '@/lib/db/shop-context'
import type { Kpis, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

const emptyKpis: Kpis = { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

const _fetchKpis = unstable_cache(
  async (shopIdsStr: string, days: number, from: string, to: string): Promise<Kpis> => {
    const shopIds = shopIdsStr ? shopIdsStr.split(',') : []
    if (shopIds.length === 0) return emptyKpis

    const supabase = createAdminClient()

    let sinceIso: string | null = null
    let untilIso: string | null = null
    let prevSinceIso: string | null = null
    let prevUntilIso: string | null = null

    if (from && to) {
      sinceIso = new Date(from).toISOString()
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
      untilIso = toDate.toISOString()
      const spanMs = toDate.getTime() - new Date(from).getTime()
      const prevTo = new Date(new Date(from).getTime() - 1)
      const prevFrom = new Date(prevTo.getTime() - spanMs)
      prevSinceIso = prevFrom.toISOString()
      prevUntilIso = prevTo.toISOString()
    } else if (days > 0) {
      const now = new Date()
      const since = new Date(now); since.setDate(since.getDate() - days + 1)
      const prevSince = new Date(since); prevSince.setDate(prevSince.getDate() - days)
      sinceIso = since.toISOString()
      prevSinceIso = prevSince.toISOString()
      prevUntilIso = since.toISOString()
    }

    const { data, error } = await supabase.rpc('get_dashboard_kpis', {
      p_shop_ids: shopIds,
      p_since: sinceIso,
      p_until: untilIso,
      p_prev_since: prevSinceIso,
      p_prev_until: prevUntilIso,
    })

    if (error || !data || data.length === 0) return emptyKpis

    const row = data[0]
    const total_revenue = Number(row.total_revenue ?? 0)
    const total_profit  = Number(row.total_profit ?? 0)
    const total_orders  = Number(row.total_orders ?? 0)
    const total_stock   = Number(row.total_stock ?? 0)

    const prev_revenue = Number(row.prev_revenue ?? 0)
    const prev_profit  = Number(row.prev_profit ?? 0)
    const prev_orders  = Number(row.prev_orders ?? 0)

    return {
      total_revenue, total_profit, total_orders, total_stock,
      change_revenue: prevSinceIso ? pct(total_revenue, prev_revenue) : null,
      change_profit:  prevSinceIso ? pct(total_profit,  prev_profit)  : null,
      change_orders:  prevSinceIso ? pct(total_orders,  prev_orders)  : null,
    }
  },
  ['kpis-rpc'],
  { revalidate: 30 },
)

export async function getKpis(
  days = 0,
  marketplace?: MarketplaceType,
  from?: string,
  to?: string,
): Promise<Kpis> {
  if (!supabaseConfigured) return emptyKpis
  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return emptyKpis
  return _fetchKpis(shopIds.join(','), days, from ?? '', to ?? '')
}
