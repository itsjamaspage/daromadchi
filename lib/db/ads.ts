import { eq, ne, and, or, isNull, inArray, gte, sql } from 'drizzle-orm'
import { db, shops, productAdsStats } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { AdsStatsSummary, MarketplaceType } from '@/lib/types'

export async function getAdsStats(
  days = 30,
  marketplace?: MarketplaceType,
): Promise<Map<string, AdsStatsSummary>> {
  const userId = await getCurrentUserId()
  if (!userId) return new Map()

  const conditions = [eq(shops.user_id, userId), or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO'))]
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

/** Per-marketplace ad-spend rollup for the Advertising page. Sources
 *  product_ads_stats (the same table the P&L "Реклама" line reads) and splits
 *  cash vs. bonus so the Yandex boost breakdown is visible. Marketplace comes
 *  from the shop, not the nullable product_ads_stats.marketplace column, so
 *  legacy WB rows are still attributed correctly. */
export interface AdSpendByMarketplace {
  marketplace: MarketplaceType
  spend: number
  cash: number
  bonus: number
  impressions: number
  clicks: number
}

export async function getAdSpendByMarketplace(days = 30): Promise<AdSpendByMarketplace[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const sinceStr = since.toISOString().split('T')[0]

  const rows = await db.select({
    marketplace: shops.marketplace,
    spend:       sql<number>`coalesce(sum(${productAdsStats.spend}), 0)`,
    cash:        sql<number>`coalesce(sum(${productAdsStats.cash_spend}), 0)`,
    bonus:       sql<number>`coalesce(sum(${productAdsStats.bonus_spend}), 0)`,
    impressions: sql<number>`coalesce(sum(${productAdsStats.impressions}), 0)`,
    clicks:      sql<number>`coalesce(sum(${productAdsStats.clicks}), 0)`,
  }).from(productAdsStats)
    .innerJoin(shops, eq(productAdsStats.shop_id, shops.id))
    .where(and(
      eq(shops.user_id, userId),
      or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO')),
      gte(productAdsStats.date, sinceStr),
    ))
    .groupBy(shops.marketplace)

  return rows
    .map(r => ({
      marketplace: r.marketplace as MarketplaceType,
      spend:       Number(r.spend),
      cash:        Number(r.cash),
      bonus:       Number(r.bonus),
      impressions: Number(r.impressions),
      clicks:      Number(r.clicks),
    }))
    .filter(r => r.spend > 0 || r.impressions > 0 || r.clicks > 0)
    .sort((a, b) => b.spend - a.spend)
}
