import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'

// A stock read is expected every ~15 min (STOCK_REFRESH_MS in the sync route);
// two missed cycles plus slack = stale.
const STALE_MINUTES = 40

export interface DriftRow {
  marketplace: string
  sku: string | null
  physicalStock: number
  groupMax: number
}

export interface ShopStatus {
  id: string
  name: string
  marketplace: 'uzum' | 'yandex_market'
  hasApiKey: boolean
  tokenValid: boolean | null
  isActive: boolean
  syncAgeMinutes: number | null
  stockSyncAgeMinutes: number | null
  syncStale: boolean
  throttledUntil: string | null
  apiMode: 'read_only' | 'stock_sync'
  productCount: number
}

export interface SystemHealth {
  noShops: boolean
  shops: ShopStatus[]
  syncAgeMinutes: number | null
  syncStale: boolean
  drift: DriftRow[]
  status: 'ok' | 'warn' | 'error'
  checkedAt: string
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const shopIds = await getShopIds()
  const checkedAt = new Date().toISOString()
  if (!shopIds || shopIds.length === 0) {
    return { noShops: true, shops: [], syncAgeMinutes: null, syncStale: false, drift: [], status: 'ok', checkedAt }
  }

  const idList = sql.join(shopIds.map(id => sql`${id}`), sql`, `)

  const [shopRes, driftRes] = await Promise.all([
    db.execute(sql`
      SELECT s.id, s.name, s.marketplace, s.is_active,
             s.api_key_encrypted IS NOT NULL AS has_api_key,
             s.token_valid, s.api_mode,
             s.throttled_until,
             extract(epoch FROM (now() - s.last_synced_at)) / 60 AS sync_age,
             extract(epoch FROM (now() - s.stock_synced_at)) / 60 AS stock_sync_age,
             (SELECT count(*) FROM products p WHERE p.shop_id = s.id AND p.is_archived = false) AS product_count
        FROM shops s
       WHERE s.id IN (${idList})
       ORDER BY s.marketplace, s.name
    `),
    db.execute(sql`
      SELECT s.marketplace, p.sku, p.physical_stock,
             (SELECT max(p2.physical_stock)
                FROM products p2 JOIN shops s2 ON s2.id = p2.shop_id
               WHERE s2.id IN (${idList})
                 AND p2.sku = p.sku) AS group_max
        FROM products p JOIN shops s ON s.id = p.shop_id
       WHERE p.shop_id IN (${idList})
         AND p.is_archived = false
         AND p.physical_stock IS NOT NULL
         AND p.physical_stock < (SELECT max(p2.physical_stock)
                                   FROM products p2 JOIN shops s2 ON s2.id = p2.shop_id
                                  WHERE s2.id IN (${idList})
                                    AND p2.sku = p.sku)
       ORDER BY p.sku, s.marketplace
    `),
  ])

  const shops: ShopStatus[] = shopRes.rows.map(r => {
    const row = r as {
      id: string; name: string; marketplace: 'uzum' | 'yandex_market'
      is_active: boolean; has_api_key: boolean; token_valid: boolean | null
      api_mode: 'read_only' | 'stock_sync'
      throttled_until: string | null
      sync_age: number | null; stock_sync_age: number | null
      product_count: string | number
    }
    const syncAge = row.sync_age == null ? null : Math.max(0, Math.round(Number(row.sync_age)))
    const stockSyncAge = row.stock_sync_age == null ? null : Math.max(0, Math.round(Number(row.stock_sync_age)))
    return {
      id: row.id,
      name: row.name,
      marketplace: row.marketplace,
      hasApiKey: row.has_api_key,
      tokenValid: row.token_valid,
      isActive: row.is_active,
      syncAgeMinutes: syncAge,
      stockSyncAgeMinutes: stockSyncAge,
      syncStale: row.is_active && row.has_api_key && (stockSyncAge == null || stockSyncAge >= STALE_MINUTES),
      throttledUntil: row.throttled_until,
      apiMode: row.api_mode,
      productCount: Number(row.product_count),
    }
  })

  const activeKeyed = shops.filter(s => s.isActive && s.hasApiKey)
  const worstAge = activeKeyed.length === 0 ? null
    : activeKeyed.reduce<number | null>((worst, s) => {
        if (s.stockSyncAgeMinutes == null) return worst
        return worst == null ? s.stockSyncAgeMinutes : Math.max(worst, s.stockSyncAgeMinutes)
      }, null)
  const syncStale = activeKeyed.length > 0 && (worstAge == null || worstAge >= STALE_MINUTES)

  const drift: DriftRow[] = driftRes.rows.map(r => {
    const row = r as { marketplace: string; sku: string | null; physical_stock: number; group_max: number }
    return { marketplace: row.marketplace, sku: row.sku, physicalStock: Number(row.physical_stock), groupMax: Number(row.group_max) }
  })

  const anyShopStale = shops.some(s => s.syncStale)
  const status: SystemHealth['status'] = anyShopStale ? 'error' : drift.length > 0 ? 'warn' : 'ok'
  return { noShops: false, shops, syncAgeMinutes: worstAge, syncStale, drift, status, checkedAt }
}
