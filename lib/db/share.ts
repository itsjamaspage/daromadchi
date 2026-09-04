import { eq, and, inArray, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userSettings, shops, products } from '@/lib/db/schema'

export interface SharedProduct {
  title: string
  sku: string | null
  image_url: string | null
  marketplace: 'uzum' | 'yandex_market'
  fulfillment_type: string | null
  stock_quantity: number
}

export async function getSharedProducts(token: string): Promise<SharedProduct[] | null> {
  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.share_token, token),
    columns: { user_id: true },
  })
  if (!row) return null

  const userShops = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops)
    .where(and(eq(shops.user_id, row.user_id), eq(shops.is_active, true)))

  if (userShops.length === 0) return []

  const shopIds = userShops.map(s => s.id)
  const mpByShop = new Map(userShops.map(s => [s.id, s.marketplace as 'uzum' | 'yandex_market']))

  const rows = await db.select({
    title: products.title,
    sku: products.sku,
    image_url: products.image_url,
    shop_id: products.shop_id,
    fulfillment_type: products.fulfillment_type,
    stock_quantity: products.stock_quantity,
  })
    .from(products)
    .where(and(
      inArray(products.shop_id, shopIds),
      eq(products.is_archived, false),
    ))
    .orderBy(asc(products.title))

  return rows.map(r => ({
    title: r.title,
    sku: r.sku,
    image_url: r.image_url,
    marketplace: mpByShop.get(r.shop_id) ?? 'uzum',
    fulfillment_type: r.fulfillment_type,
    stock_quantity: r.stock_quantity,
  }))
}
