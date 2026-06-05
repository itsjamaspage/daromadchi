import { createClient } from '@/lib/supabase/server'
import { getShopIds as resolveShopIds } from '@/lib/db/shop-context'
import type { AdCampaign, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

async function getShopIds(marketplace?: MarketplaceType): Promise<string[]> {
  return (await resolveShopIds(marketplace)) ?? []
}

export async function getAdCampaigns(marketplace?: MarketplaceType): Promise<AdCampaign[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select('*')
    .in('shop_id', shopIds)
    .order('spend', { ascending: false })

  if (error || !data) return []

  return data.map(row => ({
    id:           row.id as string,
    name:         row.name as string,
    type:         row.type as 'cpc' | 'cpo',
    status:       row.status as 'active' | 'paused' | 'stopped',
    productTitle: (row.product_title as string) ?? '',
    spend:        Number(row.spend),
    impressions:  Number(row.impressions),
    clicks:       Number(row.clicks),
    ctr:          Number(row.ctr),
    orders:       Number(row.orders),
    revenue:      Number(row.revenue),
    drr:          Number(row.drr),
    startDate:    (row.start_date as string) ?? '',
  }))
}

/**
 * Wildberries advertising, aggregated per product over the last `days` days
 * from product_ads_stats (populated by /api/wildberries/ads-sync). Returned in
 * the same AdCampaign shape so it renders alongside Uzum campaigns. Product
 * titles are joined via marketplace_product_id (the WB nmID).
 */
export async function getWbAdCampaigns(days = 30): Promise<AdCampaign[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds('wildberries')
  if (shopIds.length === 0) return []

  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days + 1)

  const { data: rows } = await supabase
    .from('product_ads_stats')
    .select('sku, date, impressions, clicks, spend, orders_from_ads, revenue_from_ads')
    .in('shop_id', shopIds)
    .gte('date', since.toISOString().slice(0, 10))
  if (!rows || rows.length === 0) return []

  // "Active" = had ad spend in the last few days; otherwise we can't claim it's
  // running (product_ads_stats is historical and has no live campaign state).
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 3)
  const recentStr = recentCutoff.toISOString().slice(0, 10)

  const skus = [...new Set(rows.map(r => String(r.sku)))]
  const titleBySku = new Map<string, string>()
  const { data: prods } = await supabase
    .from('products')
    .select('marketplace_product_id, title')
    .in('shop_id', shopIds)
    .in('marketplace_product_id', skus)
  for (const p of prods ?? []) titleBySku.set(String(p.marketplace_product_id), p.title as string)

  const agg = new Map<string, { imp: number; clicks: number; spend: number; orders: number; revenue: number; lastSpendDate: string }>()
  for (const r of rows) {
    const sku = String(r.sku)
    const a = agg.get(sku) ?? { imp: 0, clicks: 0, spend: 0, orders: 0, revenue: 0, lastSpendDate: '' }
    a.imp     += Number(r.impressions)
    a.clicks  += Number(r.clicks)
    a.spend   += Number(r.spend)
    a.orders  += Number(r.orders_from_ads)
    a.revenue += Number(r.revenue_from_ads)
    const date = String(r.date)
    if (Number(r.spend) > 0 && date > a.lastSpendDate) a.lastSpendDate = date
    agg.set(sku, a)
  }

  return [...agg.entries()]
    .map(([sku, a]) => ({
      id:           `wb-${sku}`,
      name:         titleBySku.get(sku) ?? `WB nmID ${sku}`,
      type:         'cpc' as const,
      // Derived from spend recency rather than asserted: recent spend ⇒ active.
      status:       (a.lastSpendDate >= recentStr ? 'active' : 'paused') as 'active' | 'paused' | 'stopped',
      productTitle: titleBySku.get(sku) ?? `nmID ${sku}`,
      spend:        a.spend,
      impressions:  a.imp,
      clicks:       a.clicks,
      ctr:          a.imp > 0 ? (a.clicks / a.imp) * 100 : 0,
      orders:       a.orders,
      revenue:      a.revenue,
      drr:          a.revenue > 0 ? (a.spend / a.revenue) * 100 : 0,
      startDate:    '',
    }))
    .sort((x, y) => y.spend - x.spend)
}
