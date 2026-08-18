/**
 * Recompute each account's RECOMMENDED tier from its own turnover.
 *
 * ── This is a recommendation, never an entitlement ──────────────────────────
 * It writes users.derived_tier ONLY. It never touches users.plan, which is what
 * the seller actually paid for and the only thing hasFeature() reads. A free
 * seller doing 60 mln/month gets derived_tier='pro_plus' and an upgrade prompt —
 * not Pro+ access. Wiring this into users.plan would hand out paid features for
 * free and invert the recommend-before-charge rollout.
 *
 * The band boundaries stay in TypeScript (lib/billing/tiers.ts) rather than
 * being duplicated as a SQL CASE, so there is one place to change a threshold.
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { assignTier } from '@/lib/billing/tiers'
import { computeTurnoverForAllUsers } from '@/lib/db/turnover'

// Rows per UPDATE. Bounded so a large account base cannot build one enormous
// statement; small enough to stay well inside parameter limits.
const CHUNK = 500

export interface RecomputeResult {
  /** Accounts examined. */
  scanned: number
  /** Accounts whose stored tier changed this run. */
  changed: number
  /** How many accounts now sit in each tier. */
  byTier: Record<string, number>
}

export async function recomputeDerivedTiers(): Promise<RecomputeResult> {
  const rows = await computeTurnoverForAllUsers()

  const byTier: Record<string, number> = {}
  const targets = rows.map(({ userId, turnover }) => {
    const tier = assignTier(turnover)
    byTier[tier] = (byTier[tier] ?? 0) + 1
    return { userId, turnover, tier }
  })

  let changed = 0
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK)
    const values = sql.join(
      chunk.map(t => sql`(${t.userId}::uuid, ${t.tier}::text, ${String(t.turnover)}::numeric)`),
      sql`, `,
    )
    // IS DISTINCT FROM so the timestamp only moves when the tier actually
    // changes — otherwise every run would look like a change and the nudge
    // branches could not tell a real crossing from a no-op tick.
    const res = await db.execute(sql`
      UPDATE users u
         SET derived_tier = v.tier,
             derived_turnover_som = v.turnover,
             derived_tier_computed_at = NOW()
        FROM (VALUES ${values}) AS v(user_id, tier, turnover)
       WHERE u.id = v.user_id
         AND (u.derived_tier IS DISTINCT FROM v.tier
              OR u.derived_turnover_som IS DISTINCT FROM v.turnover)
    `)
    changed += res.rowCount ?? 0
  }

  return { scanned: targets.length, changed, byTier }
}
