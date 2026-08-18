/**
 * Trailing-30-day NET turnover for one seller account.
 *
 * This number decides which tier a seller is billed at, so it is deliberately
 * stricter than the dashboard's revenue figure and every exclusion is explicit.
 * Read-only: SELECT only.
 *
 * ── Why this is not getKpis() ───────────────────────────────────────────────
 * getKpis (lib/db/kpis.ts) excludes only 'cancelled'. Turnover also excludes
 * 'returned' — a returned order earned nothing, and billing a tier on money that
 * came back is the kind of error that becomes a dispute. The two figures will
 * therefore differ, and the pricing UI has to say so; that is intended, not a bug.
 *
 * ── The four exclusions ─────────────────────────────────────────────────────
 *   1. cancelled + returned orders — never earned.
 *   2. DEMO shops — sample data, mirrors getShopIds() (lib/api/auth.ts).
 *   3. Duplicate rows — migration 071 makes (shop_id, order_id_external) unique,
 *      but the dedupe stays: it costs nothing and keeps the figure correct on any
 *      database where 071 has not been applied yet.
 *   4. NULL revenue — coalesced to 0 rather than poisoning the SUM.
 *
 * Rows with a NULL order_id_external fall back to their own primary key for
 * dedup purposes, so several such orders on one shop each count once.
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** Window the tier is computed over. */
export const TURNOVER_WINDOW_DAYS = 30

/**
 * Net turnover in so'm over the trailing 30 days, across every marketplace the
 * account has connected. Returns 0 for an unknown user, a user with no shops, or
 * a user with no earning orders in the window — all of which are legitimately
 * "no turnover" and must not be distinguishable from each other by the caller.
 */
export async function computeTurnover30d(userId: string): Promise<number> {
  const rows = await db.execute<{ turnover: string }>(sql`
    WITH deduped_orders AS (
      SELECT DISTINCT ON (o.shop_id, COALESCE(o.order_id_external, o.id::text))
             o.shop_id,
             o.revenue
        FROM orders o
        JOIN shops s ON s.id = o.shop_id
       WHERE s.user_id = ${userId}
         AND (s.shop_id_external IS NULL OR s.shop_id_external <> 'DEMO')
         AND o.ordered_at >= NOW() - (${TURNOVER_WINDOW_DAYS} || ' days')::interval
         AND o.status NOT IN ('cancelled', 'returned')
       ORDER BY o.shop_id,
                COALESCE(o.order_id_external, o.id::text),
                o.ordered_at DESC,
                o.id DESC
    )
    SELECT COALESCE(SUM(COALESCE(revenue, 0)::numeric), 0)::text AS turnover
      FROM deduped_orders
  `)

  const raw = rows.rows[0]?.turnover
  const turnover = Number(raw ?? 0)
  // A non-finite result means the aggregate came back malformed. Report 0 rather
  // than hand assignTier a number that could bill someone the wrong tier.
  return Number.isFinite(turnover) ? turnover : 0
}
