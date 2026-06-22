import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { AdsStatsSummary, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// Returns a Map<sku, AdsStatsSummary> aggregated over the given period.
export async function getAdsStats(
  days = 30,
  marketplace?: MarketplaceType,
): Promise<Map<string, AdsStatsSummary>> {
  if (!supabaseConfigured) return new Map()

  const userId = await getCurrentUserId()
  if (!userId) return new Map()

  const supabase = createAdminClient()
  let q = supabase.from('shops').select('id').eq('user_id', userId)
  if (marketplace) q = q.eq('marketplace', marketplace)
  const { data: shops } = await q
  const shopIds = (shops ?? []).map(s => s.id)
  if (shopIds.length === 0) return new Map()

  const since = new Date()
  since.setDate(since.getDate() - days + 1)

  const { data: rows } = await supabase
    .from('product_ads_stats')
    .select('sku, impressions, clicks, spend, orders_from_ads, revenue_from_ads')
    .in('shop_id', shopIds)
    .gte('date', since.toISOString().split('T')[0])

  const map = new Map<string, AdsStatsSummary>()
  for (const row of rows ?? []) {
    const sku = row.sku as string
    const prev = map.get(sku)
    const impressions  = (prev?.impressions  ?? 0) + Number(row.impressions)
    const clicks       = (prev?.clicks       ?? 0) + Number(row.clicks)
    const spend        = (prev?.spend        ?? 0) + Number(row.spend)
    const orders       = (prev?.orders_from_ads ?? 0) + Number(row.orders_from_ads)
    const revenue      = (prev?.revenue_from_ads ?? 0) + Number(row.revenue_from_ads)
    map.set(sku, {
      impressions,
      clicks,
      spend,
      orders_from_ads: orders,
      revenue_from_ads: revenue,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      drr: revenue > 0 ? (spend / revenue) * 100 : 0,
    })
  }
  return map
}
