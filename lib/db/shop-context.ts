import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { eq, ne, and, asc, inArray } from 'drizzle-orm'
import { db, shops, orders } from '@/lib/db'
import type { MarketplaceType } from '@/lib/types'

export interface ShopRef {
  id: string
  marketplace: MarketplaceType
}

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
})

export const getUserShops = cache(async (): Promise<ShopRef[]> => {
  const userId = await getCurrentUserId()
  if (!userId) return []
  const rows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops)
    .where(and(eq(shops.user_id, userId), ne(shops.shop_id_external, 'DEMO')))
  return rows as ShopRef[]
})

export const getShopIds = cache(async (marketplace?: MarketplaceType): Promise<string[] | null> => {
  const userId = await getCurrentUserId()
  if (!userId) return null
  const allShops = await getUserShops()
  const filtered = marketplace ? allShops.filter(s => s.marketplace === marketplace) : allShops
  return filtered.map(s => s.id)
})

export async function getShopLaunchDate(): Promise<string | null> {
  const shopIds = await getShopIds()
  if (!shopIds || shopIds.length === 0) return null
  const rows = await db.select({ ordered_at: orders.ordered_at })
    .from(orders)
    .where(inArray(orders.shop_id, shopIds))
    .orderBy(asc(orders.ordered_at))
    .limit(1)
  if (rows.length === 0) return null
  return rows[0].ordered_at?.toISOString() ?? null
}
