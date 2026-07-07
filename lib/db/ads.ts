import { eq, ne, and, inArray, gte } from 'drizzle-orm'
import { db, shops, productAdsStats } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { AdsStatsSummary, MarketplaceType } from '@/lib/types'

export async function getAdsStats(
  days = 30,
  marketplace?: MarketplaceType,
): Promise<Map<string, AdsStatsSummary>> {
  const userId = await getCurrentUserId()
  if (!userId) return new Map()

  const conditions = [eq(shops.user_id, userId), ne(shops.shop_id_external, 'DEMO')]
  if (marketplace) conditions.push(eq(shops.marketplace, marketplace))
  const shopRows = await db.select({ id: shops.id }).from(shops).where(and(...conditions))
  const shopIds = shopRows.map(s => s.id)
  if (shopIds.length === 0) return new Map()

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const sinceStr = since.toISOString().split('T')[0]

  const rows = await db.select({
    sku: productAdsStats.sku,
    impressions: productAdsStats.impressions,
    clicks: productAdsStats.clicks,
    spend: productAdsStats.spend,
    orders_from_ads: productAdsStats.orders_from_ads,
    revenue_from_ads: productAdsStats.revenue_from_ads,
  }).from(productAdsStats)
    .where(and(inArray(productAdsStats.shop_id, shopIds), gte(productAdsStats.date, sinceStr)))

  const map = new Map<string, AdsStatsSummary>()
  for (const row of rows) {
    const sku = row.sku
    const prev = map.get(sku)
    const impressions  = (prev?.impressions  ?? 0) + row.impressions
    const clicks       = (prev?.clicks       ?? 0) + row.clicks
    const spend        = (prev?.spend        ?? 0) + Number(row.spend)
    const ordersVal    = (prev?.orders_from_ads ?? 0) + row.orders_from_ads
    const revenue      = (prev?.revenue_from_ads ?? 0) + Number(row.revenue_from_ads)
    map.set(sku, {
      impressions,
      clicks,
      spend,
      orders_from_ads: ordersVal,
      revenue_from_ads: revenue,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      drr: revenue > 0 ? (spend / revenue) * 100 : 0,
    })
  }
  return map
}
