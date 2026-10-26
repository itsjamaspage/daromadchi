import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const GRACE_MINUTES = 5

/**
 * Product IDs with a successful stock write within the grace window.
 *
 * After a manual edit (or any stock-sync push) lands on the marketplace,
 * the marketplace's read endpoints may lag behind for a few minutes.
 * During that lag, a stock-refresh that reads the stale listing and writes
 * it back to stock_quantity undoes the edit — the exact revert the seller
 * sees.
 *
 * Callers (stock-refresh, product-sync) use this to skip overwriting
 * stock_quantity (and to keep stock_override alive) for any product that
 * was written to recently.
 */
export async function recentlyWrittenProductIds(
  productIds: string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set()
  const rows = await db.execute<{ product_id: string }>(sql`
    SELECT DISTINCT product_id
      FROM stock_write_log
     WHERE product_id = ANY(${productIds}::uuid[])
       AND status = 'sent'
       AND created_at > now() - ${`${GRACE_MINUTES} minutes`}::interval
  `)
  return new Set((rows.rows ?? rows).map((r: { product_id: string }) => r.product_id))
}
