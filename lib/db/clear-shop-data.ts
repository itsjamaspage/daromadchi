import { eq, inArray } from 'drizzle-orm'
import { db, orders, orderItems, products, syncDays, adCampaigns, searchPhrases, productAdsStats } from '@/lib/db'

export async function clearShopData(shopId: string): Promise<void> {
  const orderRows = await db.select({ id: orders.id }).from(orders)
    .where(eq(orders.shop_id, shopId))

  if (orderRows.length > 0) {
    await db.delete(orderItems)
      .where(inArray(orderItems.order_id, orderRows.map(o => o.id)))
  }

  await Promise.all([
    db.delete(orders).where(eq(orders.shop_id, shopId)),
    db.delete(products).where(eq(products.shop_id, shopId)),
    db.delete(syncDays).where(eq(syncDays.shop_id, shopId)),
    db.delete(adCampaigns).where(eq(adCampaigns.shop_id, shopId)),
    db.delete(searchPhrases).where(eq(searchPhrases.shop_id, shopId)),
    db.delete(productAdsStats).where(eq(productAdsStats.shop_id, shopId)),
  ])
}
