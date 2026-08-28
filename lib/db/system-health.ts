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
 *
 * FRESHNESS AGGREGATE — this page and the watchdog measure DIFFERENT populations
 * on purpose, and their numbers legitimately differ:
 *   • The watchdog asks "is the sync cron alive at all?" so it takes the FRESHEST
 *     read across EVERY active, keyed shop system-wide (all accounts, demo shops
 *     included). One shop syncing anywhere proves the cron runs.
 *   • This page asks "is THIS seller's data current?" — a per-seller question,
 *     scoped to the seller's own shops (getShopIds already excludes demo shops).
 *     Here the honest signal is the OLDEST of the seller's shops, not the
 *     freshest: a seller with a live Uzum shop and a Yandex shop that died three
 *     hours ago has a problem, and taking the freshest (max) would hide the dead
 *     Yandex behind the healthy Uzum. So we take the oldest (min synced_at → max
 *     age) — the laggard is the shop that can strand a seller's restock.
 * Result: the watchdog can read 4m (some shop, somewhere, just synced) while a
 * seller reads 13m (their own most-stale shop) at the same instant — both correct.
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
  /**
   * Minutes since the seller's OLDEST shop last synced (the laggard), null =
   * never synced. Oldest, not freshest, so one stale shop can't hide behind a
   * fresh sibling — see the freshness-aggregate note at the top of the file.
   */
  syncAgeMinutes: number | null
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
    return { noShops: true, syncAgeMinutes: null, syncStale: false, drift: [], status: 'ok', checkedAt }
  }

  const [freshRes, driftRes] = await Promise.all([
    // min(stock_synced_at) = the OLDEST shop → the laggard's age. See the
    // freshness-aggregate note at the top of the file for why oldest, not
    // freshest. (A shop that has never synced is NULL and min() skips it; if
    // every shop is NULL, minutes is NULL → "never synced" — same as before.)
    db.execute(sql`
      SELECT extract(epoch FROM (now() - min(stock_synced_at))) / 60 AS minutes
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
  const syncAgeMinutes = rawMinutes == null ? null : Math.max(0, Math.round(Number(rawMinutes)))
  const syncStale = syncAgeMinutes == null || syncAgeMinutes >= STALE_MINUTES

  const drift: DriftRow[] = driftRes.rows.map(r => {
    const row = r as { marketplace: string; sku: string | null; physical_stock: number; group_max: number }
    return { marketplace: row.marketplace, sku: row.sku, physicalStock: Number(row.physical_stock), groupMax: Number(row.group_max) }
  })

  const status: SystemHealth['status'] = syncStale ? 'error' : drift.length > 0 ? 'warn' : 'ok'
  return { noShops: false, syncAgeMinutes, syncStale, drift, status, checkedAt }
}
