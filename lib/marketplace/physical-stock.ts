/**
 * physical_stock reconciliation — self-populate the real on-hand pool.
 *
 * products.physical_stock is the shared-pool source for `available`
 * (computeAvailable), and it must NEVER be moved by our own writes NOR by a
 * marketplace ORDER-DECREMENT. This runs AFTER a stock refresh has pulled
 * stock_quantity from each marketplace's live listing, and adopts that listing
 * as the pool ONLY when it looks like a genuine SELLER change.
 *
 * The single UPDATE below is the SQL translation of shouldAdoptPhysicalStock()
 * (kept in stock-allocation.ts and unit-tested):
 *   • listing == a RECENT write of ours     → our throttle       → leave physical_stock
 *   • a DROP within the open reserving qty  → order-decrement    → leave physical_stock
 *   • otherwise (restock up / drop beyond pending / never-written) → seller → adopt
 *
 * ⚠️ STOPGAP, not the fix. A value-comparison rule cannot separate a genuine
 * seller reduction-while-an-order-is-open from an order-decrement, nor a
 * restore-on-cancel from a restock (see shouldAdoptPhysicalStock's note). Those
 * two cases stay wrong until the event ledger replaces this. It stops the KBWHT
 * 2→1→0 pool ratchet for current sellers.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { RESERVING_RAW_STATUSES } from '@/lib/marketplace/stock-allocation'

export async function reconcilePhysicalStock(shopId: string): Promise<void> {
  const reserving = sql`ARRAY[${sql.join(RESERVING_RAW_STATUSES.map(s => sql`${s}`), sql`, `)}]::text[]`
  await db.execute(sql`
    UPDATE products p
       SET physical_stock = p.stock_quantity
      FROM (
        SELECT pr.id,
          -- Our last push to this listing, WITHIN A WINDOW IT COULD STILL EXPLAIN.
          --
          -- The window is the fix for a permanent freeze. This used to take the
          -- most recent 'sent' write with no time bound, so once a listing's TRUE
          -- value happened to equal a value we had written at any point in the
          -- past, the value-match below read it as "our own write coming back"
          -- and refused to adopt it — forever.
          --
          -- That is not a corner case. We write the free-to-sell number, so we write 0 on
          -- every product that sells out, which is exactly when the pool most
          -- needs to reach 0. Once we had written 0, physical_stock could never
          -- adopt a genuine 0 again: JMBLK sat at 1 while both marketplaces
          -- reported 0, because a mirror write of 0 minutes earlier had poisoned
          -- the comparison permanently.
          --
          -- A write can only explain a read taken shortly after it. Stock
          -- refreshes every 15 minutes (STOCK_REFRESH_MS), so two hours is several
          -- cycles of slack and still rules out a write from days ago. Beyond the
          -- window last_write is NULL, both guards fall through, and a genuine
          -- listing value is adopted like any other seller change.
          (SELECT w.quantity FROM stock_write_log w
             WHERE w.product_id = pr.id AND w.status = 'sent'
               AND w.created_at > now() - interval '2 hours'
             ORDER BY w.created_at DESC LIMIT 1) AS last_write,
          -- units on open RESERVING orders for this listing (the order-decrement band)
          (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
            WHERE oi.product_id = pr.id
              AND (o.marketplace_status = ANY(${reserving})
                   OR (o.marketplace_status IS NULL AND o.status = 'confirmed'))
          ) AS pending
        FROM products pr WHERE pr.shop_id = ${shopId}
      ) ref
     WHERE p.id = ref.id
       AND p.physical_stock IS DISTINCT FROM p.stock_quantity
       -- not our own write coming back
       AND p.stock_quantity IS DISTINCT FROM ref.last_write
       -- not a marketplace order-decrement (a drop no deeper than pending)
       AND NOT (ref.last_write IS NOT NULL AND ref.pending > 0
                AND p.stock_quantity < ref.last_write
                AND (ref.last_write - p.stock_quantity) <= ref.pending)
       -- LEDGER-ACTIVE groups are excluded: once a group has a seed row, on_hand
       -- is authoritative and a listing must never feed the pool again (spec §7,
       -- §11, §12.1). match_key is the normalized SKU — the SQL twin of
       -- normalizeKey() (trim → lowercase → strip whitespace / . _ / -), written
       -- as a POSIX class so the SQL string needs no backslash escapes. Merge-
       -- remapped keys (rare) are not caught here, but that is inert: a seeded
       -- group's WRITES read on_hand, not physical_stock, so a stale
       -- physical_stock can never reach a marketplace.
       AND NOT EXISTS (
         SELECT 1 FROM stock_ledger sl
          WHERE sl.user_id = (SELECT sh.user_id FROM shops sh WHERE sh.id = ${shopId})
            AND sl.reason = 'seed'
            AND p.sku IS NOT NULL
            AND sl.match_key = lower(regexp_replace(trim(p.sku), '[[:space:]_./-]+', '', 'g'))
       )
  `)
  logger.info('physical_stock_reconciled', { shopId })
}
