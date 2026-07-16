import { eq, ne, and, or, isNull, gte, asc } from 'drizzle-orm'
import { db, shops, syncDays } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { SyncDay, MarketplaceType } from '@/lib/types'

async function getShopId(marketplace: MarketplaceType): Promise<string | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const [row] = await db.select({ id: shops.id }).from(shops)
    .where(and(
      eq(shops.user_id, userId),
      eq(shops.marketplace, marketplace),
      or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO')),
    ))
    .limit(1)

  return row?.id ?? null
}

export async function getSyncDays(marketplace: MarketplaceType, days = 30): Promise<SyncDay[]> {
  const shopId = await getShopId(marketplace)
  if (!shopId) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const sinceStr = since.toISOString().slice(0, 10)

  const rows = await db.select().from(syncDays)
    .where(and(eq(syncDays.shop_id, shopId), gte(syncDays.sync_date, sinceStr)))
    .orderBy(asc(syncDays.sync_date))

  return rows.map(row => {
    const raw = row.status
    const status: SyncDay['status'] =
      raw === 'success' ? 'ready' :
      raw === 'ready' || raw === 'degraded' || raw === 'error' || raw === 'pending'
        ? raw as SyncDay['status']
        : 'pending'
    return {
      date:          row.sync_date,
      status,
      productsCount: row.products_count !== null ? Number(row.products_count) : undefined,
      revenue:       row.revenue !== null ? Number(row.revenue) : undefined,
      adSpend:       row.ad_spend !== null ? Number(row.ad_spend) : undefined,
      errorMessage:  row.error_message ?? undefined,
    }
  })
}

export async function resyncDays(marketplace: MarketplaceType, dates: string[]): Promise<void> {
  if (dates.length === 0) return

  const shopId = await getShopId(marketplace)
  if (!shopId) return

  await db.insert(syncDays).values(
    dates.map(date => ({
      shop_id:   shopId,
      sync_date: date,
      status:    'pending' as const,
      synced_at: new Date(),
    }))
  ).onConflictDoUpdate({
    target: [syncDays.shop_id, syncDays.sync_date],
    set: {
      status: 'pending' as const,
      synced_at: new Date(),
    },
  })
}
