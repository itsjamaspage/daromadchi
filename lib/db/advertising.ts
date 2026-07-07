import { and, inArray, gte, desc } from 'drizzle-orm'
import { db, adCampaigns, productAdsStats, products } from '@/lib/db'
import { getShopIds as resolveShopIds } from '@/lib/db/shop-context'
import type { AdCampaign, MarketplaceType } from '@/lib/types'

async function getShopIds(marketplace?: MarketplaceType): Promise<string[]> {
  return (await resolveShopIds(marketplace)) ?? []
}

export async function getAdCampaigns(marketplace?: MarketplaceType): Promise<AdCampaign[]> {
  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const rows = await db.select().from(adCampaigns)
    .where(inArray(adCampaigns.shop_id, shopIds))
    .orderBy(desc(adCampaigns.spend))

  return rows.map(row => ({
    id:           row.id,
    name:         row.name,
    type:         row.type as 'cpc' | 'cpo',
    status:       row.status as 'active' | 'paused' | 'stopped',
    productTitle: row.product_title ?? '',
    spend:        Number(row.spend),
    impressions:  row.impressions,
    clicks:       row.clicks,
    ctr:          Number(row.ctr),
    orders:       row.orders,
    revenue:      Number(row.revenue),
    drr:          Number(row.drr),
    startDate:    row.start_date ?? '',
  }))
}

export async function getWbAdCampaigns(days = 30): Promise<AdCampaign[]> {
  const shopIds = await getShopIds('wildberries')
  if (shopIds.length === 0) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const sinceStr = since.toISOString().slice(0, 10)

  const rows = await db.select({
    sku: productAdsStats.sku,
    date: productAdsStats.date,
    impressions: productAdsStats.impressions,
    clicks: productAdsStats.clicks,
    spend: productAdsStats.spend,
    orders_from_ads: productAdsStats.orders_from_ads,
    revenue_from_ads: productAdsStats.revenue_from_ads,
  }).from(productAdsStats)
    .where(and(
      inArray(productAdsStats.shop_id, shopIds),
      gte(productAdsStats.date, sinceStr),
    ))

  if (rows.length === 0) return []

  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 3)
  const recentStr = recentCutoff.toISOString().slice(0, 10)

  const skus: string[] = [...new Set(rows.map((r: { sku: string }) => r.sku))]
  const titleBySku = new Map<string, string>()
  if (skus.length > 0) {
    const prods = await db.select({
      marketplace_product_id: products.marketplace_product_id,
      title: products.title,
    }).from(products)
      .where(and(
        inArray(products.shop_id, shopIds),
        inArray(products.marketplace_product_id, skus),
      ))
    for (const p of prods) {
      if (p.marketplace_product_id) titleBySku.set(p.marketplace_product_id, p.title)
    }
  }

  const agg = new Map<string, { imp: number; clicks: number; spend: number; orders: number; revenue: number; lastSpendDate: string }>()
  for (const r of rows) {
    const sku = r.sku
    const a = agg.get(sku) ?? { imp: 0, clicks: 0, spend: 0, orders: 0, revenue: 0, lastSpendDate: '' }
    a.imp     += r.impressions
    a.clicks  += r.clicks
    a.spend   += Number(r.spend)
    a.orders  += r.orders_from_ads
    a.revenue += Number(r.revenue_from_ads)
    if (Number(r.spend) > 0 && r.date > a.lastSpendDate) a.lastSpendDate = r.date
    agg.set(sku, a)
  }

  return [...agg.entries()]
    .map(([sku, a]) => ({
      id:           `wb-${sku}`,
      name:         titleBySku.get(sku) ?? `WB nmID ${sku}`,
      type:         'cpc' as const,
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
