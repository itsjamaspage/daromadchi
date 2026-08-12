/**
 * physical_stock reconciliation — self-populate the real on-hand pool.
 *
 * products.physical_stock is the shared-pool source for `available`
 * (computeAvailable), and it must NEVER be moved by our own throttle/mirror
 * writes. This runs AFTER a heavy product sync has refreshed stock_quantity from
 * each marketplace's live listing, and adopts that listing as the pool ONLY when
 * it is SELLER-originated — i.e. it differs from our most-recent stock write for
 * that product. A read that equals our last write is our own throttle coming
 * back, and is ignored, so our writes can never feed the pool.
 *
 * The single UPDATE below is the SQL translation of physicalStockFromRead()
 * applied per row (kept in stock-allocation.ts and unit-tested):
 *   • last sent write == current listing  → our throttle  → leave physical_stock
 *   • otherwise (incl. never-written: NULL) → seller change → physical_stock = listing
 */

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Reconcile physical_stock for every product of one shop from the just-synced
 * stock_quantity. Best-effort — callers should not let a failure block the sync.
 */
export async function reconcilePhysicalStock(shopId: string): Promise<void> {
  await db.execute(sql`
    UPDATE products p
       SET physical_stock = p.stock_quantity
     WHERE p.shop_id = ${shopId}
       AND p.physical_stock IS DISTINCT FROM p.stock_quantity
       AND p.stock_quantity IS DISTINCT FROM (
         SELECT w.quantity
           FROM stock_write_log w
          WHERE w.product_id = p.id
            AND w.status = 'sent'
          ORDER BY w.created_at DESC
          LIMIT 1
       )
  `)
  logger.info('physical_stock_reconciled', { shopId })
}
