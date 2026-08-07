import { NextResponse } from 'next/server'
import { and, eq, lte, isNotNull, sql } from 'drizzle-orm'
import { db, shops, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { fetchUzumOrdersCount, fetchUzumShops } from '@/lib/uzum/client'
import { syncStockSyncGroups } from '@/lib/marketplace/stock-sync'

export const runtime = 'nodejs'
export const maxDuration = 300

// Tiered polling: shops with a low-stock listing (real oversell risk) are polled
// every run; the rest at most every COARSE interval, to stay within Uzum's rate
// limits. A changed CREATED-order count is the trigger to run Step A/B.
const LOW_STOCK_THRESHOLD = 3
const COARSE_INTERVAL_MS = 30 * 60 * 1000

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // Uzum stock_sync shops only (YM is driven by its webhook).
  const shopRows = await db.select({
    id: shops.id,
    user_id: shops.user_id,
    shop_id_external: shops.shop_id_external,
    api_key_encrypted: shops.api_key_encrypted,
    last_orders_count: shops.last_orders_count,
    stock_poll_at: shops.stock_poll_at,
  }).from(shops).where(and(
    eq(shops.marketplace, 'uzum'),
    eq(shops.api_mode, 'stock_sync'),
    eq(shops.is_active, true),
    isNotNull(shops.api_key_encrypted),
  ))

  const now = Date.now()
  const usersToSync = new Set<string>()
  const results: Record<string, unknown>[] = []
  let dailyCapHit = false

  for (const shop of shopRows) {
    if (dailyCapHit) { results.push({ shopId: shop.id, skipped: 'daily_cap' }); continue }

    // Tier: does this shop carry a low-stock listing right now?
    const [{ lowCount }] = await db.select({ lowCount: sql<number>`count(*)` })
      .from(products).where(and(eq(products.shop_id, shop.id), lte(products.stock_quantity, LOW_STOCK_THRESHOLD)))
    const aggressive = Number(lowCount) > 0
    const dueForCoarse = !shop.stock_poll_at || (now - new Date(shop.stock_poll_at).getTime()) >= COARSE_INTERVAL_MS
    if (!aggressive && !dueForCoarse) { results.push({ shopId: shop.id, skipped: 'not_due' }); continue }

    try {
      const token = decrypt(shop.api_key_encrypted!)
      // Resolve the numeric Uzum shopId for orders/count.
      let uzumShopIds: number[] = []
      if (shop.shop_id_external && /^\d+$/.test(shop.shop_id_external)) {
        uzumShopIds = [Number(shop.shop_id_external)]
      } else {
        uzumShopIds = (await fetchUzumShops(token)).map(s => s.id).filter(Boolean)
      }
      if (uzumShopIds.length === 0) { results.push({ shopId: shop.id, skipped: 'no_uzum_shop_id' }); continue }

      const countRes = await fetchUzumOrdersCount(token, uzumShopIds, 'CREATED')
      if (countRes.rateLimitRemainingPerDay === 0) dailyCapHit = true

      const changed = countRes.count != null && countRes.count !== shop.last_orders_count
      await db.update(shops).set({
        last_orders_count: countRes.count ?? shop.last_orders_count,
        stock_poll_at: new Date(),
      }).where(eq(shops.id, shop.id))

      // Sync this stock_sync user UNCONDITIONALLY — do NOT gate on the count
      // delta. The CREATED-count detector is edge-triggered and misses a sale
      // that opens and closes CREATED inside one poll window (the sync then
      // never runs → usersSynced:0). The tier above already sets the cadence:
      // aggressive (low-stock) shops reach here every cycle, healthy shops every
      // COARSE interval — so this catches a missed sale within that window.
      // Cheap: syncStockSyncGroups only issues a marketplace WRITE on a real
      // target != listed diff, so idle runs make ZERO write calls (just DB reads
      // + the identifier existence check). `changed` is kept for logging only.
      usersToSync.add(shop.user_id)
      results.push({ shopId: shop.id, aggressive, count: countRes.count, prev: shop.last_orders_count, changed, remainingPerDay: countRes.rateLimitRemainingPerDay })
    } catch (err) {
      results.push({ shopId: shop.id, error: String(err).slice(0, 200) })
    }
  }

  // Run Step A/B for every stock_sync user polled this cycle (no longer gated
  // on a count delta — see above). Writes are always live and fire only on a
  // real diff, so a no-change user's run is DB-only with no marketplace writes.
  const runs: Record<string, unknown>[] = []
  for (const userId of usersToSync) {
    try {
      const r = await syncStockSyncGroups({ userId })
      runs.push({ userId, groupsConsidered: r.groupsConsidered, writesPlanned: r.writesPlanned, entries: r.entries })
    } catch (err) {
      runs.push({ userId, error: String(err).slice(0, 200) })
    }
  }

  logger.info('stock_sync_cron', { polled: results.length, usersSynced: usersToSync.size, dailyCapHit })
  return NextResponse.json({ ok: true, polled: results.length, usersSynced: usersToSync.size, dailyCapHit, results, runs })
})
