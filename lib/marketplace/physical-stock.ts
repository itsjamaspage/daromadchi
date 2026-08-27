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
 *   • listing == our last write            → our throttle       → leave physical_stock
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
          -- our authoritative last push to this listing (value-match = our write)
          (SELECT w.quantity FROM stock_write_log w
             WHERE w.product_id = pr.id AND w.status = 'sent'
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
  `)
  logger.info('physical_stock_reconciled', { shopId })
}
