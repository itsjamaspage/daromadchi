import { NextRequest, NextResponse } from 'next/server'
import { and, ne, lt } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { recomputeDerivedTiers } from '@/lib/db/derived-tier'
import { dispatchDuePriceNotices } from '@/lib/billing/price-notice'
import { dispatchTierNudges } from '@/lib/billing/nudge'

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

  // Tell anyone whose staged price change is approaching. Rides this job rather
  // than adding a scheduler, same as the tier recompute above.
  //
  // Best-effort for the same reason: the downgrade sweep is this job's contract.
  // A failure here cannot overcharge anyone — an undelivered notice leaves
  // pending_notified_at NULL, and the renewal refuses to charge a new amount
  // without it, so the seller keeps paying what they agreed to.
  let notices: Awaited<ReturnType<typeof dispatchDuePriceNotices>> | null = null
  try {
    notices = await dispatchDuePriceNotices()
    if (notices.due > 0) logger.info('price_notice_sweep_done', { ...notices })
  } catch (err) {
    logger.error('price_notice_sweep_failed', { error: String(err).slice(0, 300) })
  }

  // Free-tier nudges: trial ending, trial over, turnover outgrew Free. Runs
  // AFTER the tier recompute above, so "outgrew free" reads today's figure
  // rather than yesterday's.
  //
  // Best-effort, and unlike the price notice a failure here is harmless: a nudge
  // is a suggestion, and nothing is charged or gated on whether it arrived.
  let nudges: Awaited<ReturnType<typeof dispatchTierNudges>> | null = null
  try {
    nudges = await dispatchTierNudges()
    if (nudges.trialEnding + nudges.trialEnded + nudges.outgrewFree > 0) {
      logger.info('tier_nudge_sweep_done', { ...nudges })
    }
  } catch (err) {
    logger.error('tier_nudge_sweep_failed', { error: String(err).slice(0, 300) })
  }

  return NextResponse.json({ ok: true, downgraded: rows.length, tiers, notices, nudges })
})
