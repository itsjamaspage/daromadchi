import { sql, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import { userSettings } from '@/lib/db/schema'

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

export type ServiceStatus = 'operational' | 'degraded' | 'down'

export interface ServiceRow {
  name: string
  key: string
  status: ServiceStatus
  detail: string | null
}

export interface SystemHealth {
  noShops: boolean
  shops: ShopStatus[]
  services: ServiceRow[]
  overall: ServiceStatus
  syncAgeMinutes: number | null
  syncStale: boolean
  drift: DriftRow[]
  status: 'ok' | 'warn' | 'error'
  checkedAt: string
  telegramConnected: boolean
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [shopIds, userId] = await Promise.all([getShopIds(), getCurrentUserId()])
  const checkedAt = new Date().toISOString()
  if (!shopIds || shopIds.length === 0) {
    return {
      noShops: true, shops: [], services: [], overall: 'operational',
      syncAgeMinutes: null, syncStale: false, drift: [],
      status: 'ok', checkedAt, telegramConnected: false,
    }
  }

  const idList = sql.join(shopIds.map(id => sql`${id}`), sql`, `)

  const [shopRes, driftRes, tgRes] = await Promise.all([
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
    userId
      ? db.select({ telegram_bot_token: userSettings.telegram_bot_token, telegram_chat_id: userSettings.telegram_chat_id })
          .from(userSettings).where(eq(userSettings.user_id, userId)).limit(1)
      : Promise.resolve([]),
  ])

  const telegramConnected = tgRes.length > 0 && !!tgRes[0].telegram_bot_token && !!tgRes[0].telegram_chat_id

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

  const uzumShops = shops.filter(s => s.marketplace === 'uzum')
  const ymShops = shops.filter(s => s.marketplace === 'yandex_market')

  function mpSyncStatus(mpShops: ShopStatus[]): ServiceRow {
    const mp = mpShops[0]?.marketplace
    const label = mp === 'uzum' ? 'Uzum Market' : 'Yandex Market'
    const key = mp === 'uzum' ? 'sync_uzum' : 'sync_yandex'
    if (mpShops.length === 0) return { name: label, key, status: 'down', detail: null }
    const anyStale = mpShops.some(s => s.syncStale)
    const allNoKey = mpShops.every(s => !s.hasApiKey)
    if (allNoKey) return { name: label, key, status: 'down', detail: null }
    if (anyStale) {
      const worst = mpShops.reduce<number | null>((w, s) => {
        if (s.stockSyncAgeMinutes == null) return w
        return w == null ? s.stockSyncAgeMinutes : Math.max(w, s.stockSyncAgeMinutes)
      }, null)
      return { name: label, key, status: 'degraded', detail: worst != null ? String(worst) : null }
    }
    const best = mpShops.reduce<number | null>((b, s) => {
      if (s.stockSyncAgeMinutes == null) return b
      return b == null ? s.stockSyncAgeMinutes : Math.min(b, s.stockSyncAgeMinutes)
    }, null)
    return { name: label, key, status: 'operational', detail: best != null ? String(best) : null }
  }

  function mpApiStatus(mpShops: ShopStatus[]): ServiceRow {
    const mp = mpShops[0]?.marketplace
    const label = mp === 'uzum' ? 'Uzum API' : 'Yandex API'
    const key = mp === 'uzum' ? 'api_uzum' : 'api_yandex'
    if (mpShops.length === 0) return { name: label, key, status: 'down', detail: null }
    const allNoKey = mpShops.every(s => !s.hasApiKey)
    if (allNoKey) return { name: label, key, status: 'down', detail: null }
    const anyThrottled = mpShops.some(s => s.throttledUntil && new Date(s.throttledUntil) > new Date())
    const anyInvalid = mpShops.some(s => s.tokenValid === false)
    if (anyInvalid) return { name: label, key, status: 'down', detail: null }
    if (anyThrottled) return { name: label, key, status: 'degraded', detail: null }
    return { name: label, key, status: 'operational', detail: null }
  }

  const services: ServiceRow[] = []
  if (uzumShops.length > 0) {
    services.push(mpSyncStatus(uzumShops))
    services.push(mpApiStatus(uzumShops))
  }
  if (ymShops.length > 0) {
    services.push(mpSyncStatus(ymShops))
    services.push(mpApiStatus(ymShops))
  }
  services.push({
    name: 'Telegram',
    key: 'telegram',
    status: telegramConnected ? 'operational' : 'down',
    detail: null,
  })

  const overall: ServiceStatus = services.some(s => s.status === 'down') ? 'down'
    : services.some(s => s.status === 'degraded') ? 'degraded'
    : 'operational'

  const anyShopStale = shops.some(s => s.syncStale)
  const status: SystemHealth['status'] = anyShopStale ? 'error' : drift.length > 0 ? 'warn' : 'ok'
  return { noShops: false, shops, services, overall, syncAgeMinutes: worstAge, syncStale, drift, status, checkedAt, telegramConnected }
}
