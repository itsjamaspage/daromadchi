/**
 * Trailing-30-day NET turnover per seller account.
 *
 * This number decides which tier a seller is RECOMMENDED, so it is deliberately
 * stricter than the dashboard's revenue figure and every exclusion is explicit.
 * Read-only: SELECT only.
 *
 * ── Why this is not getKpis() ───────────────────────────────────────────────
 * getKpis (lib/db/kpis.ts) excludes only 'cancelled'. Turnover also excludes
 * 'returned' — a returned order earned nothing, and putting a seller in a higher
 * tier on money that came back is the kind of error that becomes a dispute. The
 * two figures will differ, and the pricing UI has to say so; that is intended.
 *
 * ── The four exclusions ─────────────────────────────────────────────────────
 *   1. cancelled + returned orders — never earned.
 *   2. DEMO shops — sample data, mirrors getShopIds() (lib/api/auth.ts).
 *   3. Duplicate rows — migration 071 makes (shop_id, order_id_external) unique,
 *      but the dedupe stays: it costs nothing and keeps the figure correct on a
 *      database where 071 has not been applied yet.
 *   4. NULL revenue — coalesced to 0 rather than poisoning the SUM.
 *
 * The single-account and all-accounts queries are built from ONE fragment
 * below. They must never drift: a seller's tier would then depend on which code
 * path last wrote it.
 */
import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'

/** Window the tier is computed over. */
export const TURNOVER_WINDOW_DAYS = 30

/**
 * Turnover per user, as `(user_id, turnover)` rows.
 *
 * `userId` scopes BOTH the dedup CTE and the outer join — pushing the filter
 * into the CTE keeps the single-account call from deduping every order in the
 * table. Users are LEFT JOINed so an account with no shops or no orders still
 * comes back with 0 rather than vanishing; the recompute needs a row for
 * everyone, and a silently missing user would keep a stale tier forever.
 */
function turnoverByUser(userId?: string): SQL {
  const scopeToUser = userId ? sql`AND owner.user_id = ${userId}` : sql``
  const filterUser = userId ? sql`WHERE u.id = ${userId}` : sql``
  return sql`
    WITH deduped_orders AS (
      SELECT DISTINCT ON (o.shop_id, COALESCE(o.order_id_external, o.id::text))
             o.shop_id,
             o.revenue
        FROM orders o
        JOIN shops owner ON owner.id = o.shop_id
       WHERE (owner.shop_id_external IS NULL OR owner.shop_id_external <> 'DEMO')
         AND o.ordered_at >= NOW() - (${TURNOVER_WINDOW_DAYS} || ' days')::interval
         AND o.status NOT IN ('cancelled', 'returned')
         ${scopeToUser}
       ORDER BY o.shop_id,
                COALESCE(o.order_id_external, o.id::text),
                o.ordered_at DESC,
                o.id DESC
    )
    SELECT u.id::text AS user_id,
           COALESCE(SUM(COALESCE(d.revenue, 0)::numeric), 0)::text AS turnover
      FROM users u
      LEFT JOIN shops s
             ON s.user_id = u.id
            AND (s.shop_id_external IS NULL OR s.shop_id_external <> 'DEMO')
      LEFT JOIN deduped_orders d ON d.shop_id = s.id
      ${filterUser}
     GROUP BY u.id
  `
}

function toFiniteNumber(raw: string | null | undefined): number {
  const n = Number(raw ?? 0)
  // A non-finite aggregate must never reach assignTier — it would decide a tier
  // from a broken number. 0 recommends 'free', which is the safe direction.
  return Number.isFinite(n) ? n : 0
}

/**
 * Net turnover in so'm over the trailing 30 days for one account, across every
 * marketplace it has connected. Returns 0 for an unknown user, a user with no
 * shops, and a user with no earning orders — all legitimately "no turnover".
 */
export async function computeTurnover30d(userId: string): Promise<number> {
  const res = await db.execute<{ user_id: string; turnover: string }>(turnoverByUser(userId))
  return toFiniteNumber(res.rows[0]?.turnover)
}

export interface UserTurnover {
  userId: string
  turnover: number
}

/** The same figure for every account, in one query. */
export async function computeTurnoverForAllUsers(): Promise<UserTurnover[]> {
  const res = await db.execute<{ user_id: string; turnover: string }>(turnoverByUser())
  return res.rows.map(r => ({ userId: r.user_id, turnover: toFiniteNumber(r.turnover) }))
}
