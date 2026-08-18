import { NextRequest, NextResponse } from 'next/server'
import { and, ne, lt } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { recomputeDerivedTiers } from '@/lib/db/derived-tier'

// Called by the cron job daily. Downgrades users whose plan_expires_at
// has passed. `plan` is a Postgres enum; the string cast at .set()
// matches the column shape in lib/db/schema.ts (planTypeEnum).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth   = req.headers.get('authorization')
  const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Downgrade lapsed paid plans to free. The ne(plan,'free') guard means this
  // fires once, on the paid→free transition.
  const rows = await db.update(users)
    .set({ plan: 'free', plan_expires_at: null })
    .where(and(
      ne(users.plan, 'free'),
      lt(users.plan_expires_at, new Date()),
    ))
    .returning({ id: users.id })

  // Refresh the turnover-derived tier RECOMMENDATION for every account. This
  // rides the existing daily job rather than adding a scheduler — the crontab on
  // the VPS already calls expire-plans, and a recommendation does not need to be
  // fresher than a day. It writes users.derived_tier only; entitlement above is
  // untouched, so this can never grant or remove access.
  //
  // Best-effort: a failure here must not stop the downgrade sweep, which is the
  // job's actual contract.
  let tiers: Awaited<ReturnType<typeof recomputeDerivedTiers>> | null = null
  try {
    tiers = await recomputeDerivedTiers()
    logger.info('derived_tier_recompute_done', { ...tiers })
  } catch (err) {
    logger.error('derived_tier_recompute_failed', { error: String(err).slice(0, 300) })
  }

  return NextResponse.json({ ok: true, downgraded: rows.length, tiers })
})
