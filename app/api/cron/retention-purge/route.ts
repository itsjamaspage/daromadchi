import { NextResponse } from 'next/server'
import { and, eq, lt, isNotNull } from 'drizzle-orm'
import { db, users, payments } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// 30-day post-cancellation retention purge.
//
// Deletes accounts whose paid plan lapsed (users.plan_cancelled_at set by
// billing/expire-plans) more than RETENTION_DAYS ago and were NOT re-subscribed
// (still plan='free' with plan_cancelled_at still set — re-subscribe nulls it).
// Deletion removes all personal data via the users FK cascade; payment/tax
// records are preserved because payments.user_id is ON DELETE SET NULL
// (migration 055) — and, defensively, each user's payments are detached BEFORE
// the delete, so if 055 has not been applied the detach errors and the user is
// SKIPPED rather than cascade-deleting their financial records.
//
// SAFETY: dry-run by default. It reports what it WOULD delete and deletes
// nothing unless RETENTION_PURGE_ENABLED === 'true'. Arm it only after the
// migration is applied and the dry-run output has been reviewed.

const RETENTION_DAYS = 30
const MAX_PER_RUN = 100 // guard against a runaway mass-delete

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const armed = process.env.RETENTION_PURGE_ENABLED === 'true'
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  // Candidates: cancelled > RETENTION_DAYS ago AND still free (not re-subscribed).
  const candidates = await db.select({
    id: users.id,
    email: users.email,
    plan_cancelled_at: users.plan_cancelled_at,
  }).from(users)
    .where(and(
      eq(users.plan, 'free'),
      isNotNull(users.plan_cancelled_at),
      lt(users.plan_cancelled_at, cutoff),
    ))
    .limit(MAX_PER_RUN)

  if (!armed) {
    logger.info('retention_purge_dryrun', { cutoff: cutoff.toISOString(), candidates: candidates.length })
    return NextResponse.json({
      ok: true,
      dryRun: true,
      note: 'RETENTION_PURGE_ENABLED is not "true" — nothing was deleted. This is the would-delete list.',
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      wouldDelete: candidates.map(c => ({ id: c.id, email: c.email, cancelledAt: c.plan_cancelled_at })),
    })
  }

  const deleted: string[] = []
  const skipped: { id: string; error: string }[] = []
  for (const c of candidates) {
    try {
      await db.transaction(async (tx) => {
        // Detach payments FIRST. If migration 055 is not applied (user_id still
        // NOT NULL), this throws → the tx rolls back → the user is NOT deleted
        // and no financial records are lost.
        await tx.update(payments).set({ user_id: null }).where(eq(payments.user_id, c.id))
        // Personal data goes via the users cascade.
        await tx.delete(users).where(eq(users.id, c.id))
      })
      deleted.push(c.id)
      logger.info('retention_purge_deleted', { userId: c.id, cancelledAt: c.plan_cancelled_at })
    } catch (err) {
      skipped.push({ id: c.id, error: String(err).slice(0, 200) })
      logger.error('retention_purge_skip', { userId: c.id, error: String(err).slice(0, 300) })
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    retentionDays: RETENTION_DAYS,
    cutoff: cutoff.toISOString(),
    deletedCount: deleted.length,
    deleted,
    skipped,
  })
})
