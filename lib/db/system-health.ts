import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'

/**
 * In-app system health — "is anything wrong with my data?" answered inside
 * Daromadchi instead of a Telegram page. Computed LIVE from the DB when the seller
 * opens the status view, scoped to their own shops. Same two signals the
 * background watchdog logs:
 *   • sync freshness — how long since a stock read completed (the app can look
 *     "online" while sync has silently stopped; this is the honest signal).
 *   • stock drift — a cross-marketplace listing whose physical_stock sits below
 *     its group's on-hand (a corrupted-low row / lost unit). BETWEEN-marketplace
 *     only: a whole group drifting down together is invisible here.
 */

// A stock read is expected every ~15 min (STOCK_REFRESH_MS in the sync route);
// two missed cycles plus slack = stale.
const STALE_MINUTES = 40

export interface DriftRow {
  marketplace: string
  sku: string | null
  physicalStock: number
  groupMax: number
}

export interface SystemHealth {
  /** true when there are no active, keyed shops — nothing to report. */
  noShops: boolean
  /** minutes since the freshest successful stock read; null = never synced. */
  freshestSyncMinutes: number | null
  syncStale: boolean
  /** listings whose physical_stock is below their group's max. */
  drift: DriftRow[]
  /** overall: 'ok' | 'warn' (drift only) | 'error' (sync stale). */
  status: 'ok' | 'warn' | 'error'
  checkedAt: string
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const shopIds = await getShopIds()
  const checkedAt = new Date().toISOString()
  if (!shopIds || shopIds.length === 0) {
    return { noShops: true, freshestSyncMinutes: null, syncStale: false, drift: [], status: 'ok', checkedAt }
  }

  const [freshRes, driftRes] = await Promise.all([
    db.execute(sql`
      SELECT extract(epoch FROM (now() - max(stock_synced_at))) / 60 AS minutes
        FROM shops
       WHERE id IN (${sql.join(shopIds.map(id => sql`${id}`), sql`, `)})
         AND is_active = true AND api_key_encrypted IS NOT NULL
    `),
    db.execute(sql`
      SELECT s.marketplace, p.sku, p.physical_stock,
             (SELECT max(p2.physical_stock)
                FROM products p2 JOIN shops s2 ON s2.id = p2.shop_id
               WHERE s2.id IN (${sql.join(shopIds.map(id => sql`${id}`), sql`, `)})
                 AND p2.sku = p.sku) AS group_max
        FROM products p JOIN shops s ON s.id = p.shop_id
       WHERE p.shop_id IN (${sql.join(shopIds.map(id => sql`${id}`), sql`, `)})
         AND p.is_archived = false
         AND p.physical_stock IS NOT NULL
         AND p.physical_stock < (SELECT max(p2.physical_stock)
                                   FROM products p2 JOIN shops s2 ON s2.id = p2.shop_id
                                  WHERE s2.id IN (${sql.join(shopIds.map(id => sql`${id}`), sql`, `)})
                                    AND p2.sku = p.sku)
       ORDER BY p.sku, s.marketplace
    `),
  ])

  const rawMinutes = (freshRes.rows[0] as { minutes: number | null } | undefined)?.minutes ?? null
  const freshestSyncMinutes = rawMinutes == null ? null : Math.max(0, Math.round(Number(rawMinutes)))
  const syncStale = freshestSyncMinutes == null || freshestSyncMinutes >= STALE_MINUTES

  const drift: DriftRow[] = driftRes.rows.map(r => {
    const row = r as { marketplace: string; sku: string | null; physical_stock: number; group_max: number }
    return { marketplace: row.marketplace, sku: row.sku, physicalStock: Number(row.physical_stock), groupMax: Number(row.group_max) }
  })

  const status: SystemHealth['status'] = syncStale ? 'error' : drift.length > 0 ? 'warn' : 'ok'
  return { noShops: false, freshestSyncMinutes, syncStale, drift, status, checkedAt }
}
