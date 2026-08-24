import { cache } from 'react'
import { getCurrentUser } from '@/lib/auth/session'
import { eq, ne, and, or, isNull, asc, inArray, desc } from 'drizzle-orm'
import { db, shops, orders, syncDays } from '@/lib/db'
import type { MarketplaceType } from '@/lib/types'

export interface ShopRef {
  id: string
  marketplace: MarketplaceType
}

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser()
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
    .where(and(eq(shops.user_id, userId), eq(shops.is_active, true), or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO'))))
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

export interface SyncAlert {
  shopName: string
  status: 'error' | 'degraded'
  message: string | null
  syncedAt: string | null
}

export interface SyncInfo {
  lastSyncedAt: string | null
  lastSyncFailed: boolean
  alerts: SyncAlert[]
}

export const getSyncInfo = cache(async (): Promise<SyncInfo> => {
  const shopIds = await getShopIds()
  if (!shopIds || shopIds.length === 0) return { lastSyncedAt: null, lastSyncFailed: false, alerts: [] }

  const rows = await db.select({ last_synced_at: shops.last_synced_at })
    .from(shops)
    .where(inArray(shops.id, shopIds))
    .orderBy(desc(shops.last_synced_at))
    .limit(1)

  const lastSyncedAt = rows[0]?.last_synced_at?.toISOString() ?? null

  const today = new Date().toISOString().slice(0, 10)
  const alertRows = await db.select({
    name: shops.name,
    status: syncDays.status,
    error_message: syncDays.error_message,
    synced_at: syncDays.synced_at,
  })
    .from(syncDays)
    .innerJoin(shops, eq(syncDays.shop_id, shops.id))
    .where(and(
      inArray(syncDays.shop_id, shopIds),
      eq(syncDays.sync_date, today),
      or(eq(syncDays.status, 'error'), eq(syncDays.status, 'degraded')),
    ))

  const alerts: SyncAlert[] = alertRows.map(r => ({
    shopName: r.name ?? 'Shop',
    status: r.status as 'error' | 'degraded',
    message: r.error_message,
    syncedAt: r.synced_at?.toISOString() ?? null,
  }))

  return { lastSyncedAt, lastSyncFailed: alerts.some(a => a.status === 'error'), alerts }
})
