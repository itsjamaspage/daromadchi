import { inArray, desc } from 'drizzle-orm'
import { db, searchPhrases } from '@/lib/db'
import { getShopIds as resolveShopIds } from '@/lib/db/shop-context'
import type { SearchPhrase, MarketplaceType } from '@/lib/types'

async function getShopIds(marketplace?: MarketplaceType): Promise<string[]> {
  return (await resolveShopIds(marketplace)) ?? []
}

export async function getSearchPhrases(marketplace?: MarketplaceType): Promise<SearchPhrase[]> {
  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const rows = await db.select().from(searchPhrases)
    .where(inArray(searchPhrases.shop_id, shopIds))
    .orderBy(desc(searchPhrases.impressions))

  return rows.map(row => ({
    id:           row.id,
    productId:    row.product_id ?? '',
    productTitle: row.product_title ?? '',
    phrase:       row.phrase,
    impressions:  row.impressions,
    clicks:       row.clicks,
    ctr:          Number(row.ctr),
    orders:       row.orders,
    spend:        Number(row.spend),
  }))
}
