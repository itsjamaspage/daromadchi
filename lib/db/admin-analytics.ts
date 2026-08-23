/**
 * Admin-only subscription + revenue analytics, read from OUR OWN database.
 *
 * Read-only: this module only SELECTs. It never touches ATMOS and never writes.
 *
 * ── Status semantics (derived from how the app actually writes these rows) ───
 * payments.atmos_status is the authoritative ATMOS lifecycle; payments.status is
 * the legacy display column flipped in lockstep inside the same settle
 * transaction (lib/billing/activate.ts). PAID therefore = atmos_status 'success'
 * OR status 'paid' (the OR also covers pre-ATMOS legacy rows).
 *
 * subscriptions.status starts 'pending' and becomes 'active' on settlement;
 * the renewal cron sets 'past_due' on a failed charge. NOTHING in the codebase
 * currently writes 'cancelled' or 'expired' — a lapsed subscription is left
 * 'active' (or 'past_due') with a current_period_end in the past, while
 * expire-plans downgrades users.plan separately. So "churn" must be derived:
 *
 *   ACTIVE   status 'active' AND (period_end IS NULL OR period_end > now)
 *   LAPSED   status 'cancelled'/'expired'  OR  status 'active'/'past_due'
 *            whose period_end has already passed
 *   AT RISK  status 'past_due' still inside its paid period
 *   IGNORED  status 'pending' — checkout started, never settled; not a customer
 */
import 'server-only'
import { and, desc, eq, ne, or, sql } from 'drizzle-orm'
import { db, payments, subscriptions, users } from '@/lib/db'
import {
  PLAN_PRICES_TIYIN,
  planAmountTiyin,
  planAnnualTotalTiyin,
  type Interval,
  type PlanKey,
  isPlanKey,
} from '@/lib/billing/plans'

/* ── time ───────────────────────────────────────────────────────────────────── */

// Uzbekistan is UTC+5 year-round (no DST), so "this month" is the Tashkent month.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

export function tashkentMonthStart(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TASHKENT_OFFSET_MS)
}

/* ── normalizers ────────────────────────────────────────────────────────────── */

// plan/interval are free-text columns; anything unrecognised is excluded from
// money math rather than silently priced as Pro.
function normPlan(v: string | null): PlanKey | null {
  // Every plan with a price counts toward the money math. Listing keys by hand
  // left Biznes revenue out of MRR entirely.
  return isPlanKey(v) ? v : null
}

function normInterval(v: string | null): Interval {
  return v === 'annual' ? 'annual' : 'monthly'
}

/** A subscription's monthly-normalized value: yearly plans are annualTotal / 12. */
function monthlyValueTiyin(plan: PlanKey, interval: Interval): number {
  return interval === 'annual'
    ? Math.round(planAnnualTotalTiyin(plan) / 12)
    : PLAN_PRICES_TIYIN[plan].monthly
}

/* ── shapes ─────────────────────────────────────────────────────────────────── */

export type ChurnReason = 'cancelled' | 'expired' | 'lapsed'
export type PaymentState = 'paid' | 'pending' | 'failed' | 'cancelled'

export interface PlanSplit {
  count: number
  /** Monthly-normalized recurring value (tiyin). */
  mrrTiyin: number
}

export interface AdminMetrics {
  mrrTiyin: number
  /** MRR × 12 — the run-rate implied by today's active book. */
  arrTiyin: number
  totalRevenueTiyin: number
  monthRevenueTiyin: number
  paidPaymentCount: number
  activeCount: number
  /** One entry per billable plan — widens automatically when PlanKey gains a tier. */
  byPlan: Record<PlanKey, PlanSplit>
  byInterval: { monthly: PlanSplit; annual: PlanSplit }
  /** New SUBSCRIPTIONS that started this month ("new paid this month"). */
  newThisMonth: number
  churnedThisMonth: number
  /** Renewal charge failed but the paid period has not run out yet. */
  pastDueCount: number

  /* ── user-base funnel (from the users table, not subscriptions) ─────────────
   * "Registered" and "paying" are deliberately DISTINCT figures. A trial user
   * has plan = 'free' with a future trial_ends_at, so `plan <> 'free'` never
   * counts a trial as paying — trials are surfaced on their own line. */
  /** Everyone who ever signed up (all-time). */
  totalUsers: number
  /** Accounts created this calendar month ("new signups this month"). */
  newUsersThisMonth: number
  /** Currently entitled to a paid tier (plan <> 'free', not expired). Never a trial. */
  paidPlanUsers: number
  /** Currently inside a free trial (plan = 'free', trial_ends_at in the future). NOT paying. */
  trialUsers: number
  /** Legacy grandfathered accounts — full access, plan column usually reads 'free'. */
  grandfatheredUsers: number
}

export interface ActiveSubscriberRow {
  id: string
  email: string | null
  plan: string
  interval: Interval
  /** Amount charged per period (tiyin) — one month or one year. */
  amountTiyin: number
  /** Monthly-normalized contribution to MRR (tiyin). */
  mrrTiyin: number
  startedAt: string
  periodEnd: string | null
  autorenew: boolean
}

export interface RecentPaymentRow {
  id: string
  date: string
  email: string | null
  plan: string
  interval: Interval
  amountTiyin: number
  state: PaymentState
}

export interface ChurnedRow {
  id: string
  email: string | null
  plan: string
  interval: Interval
  lapsedAt: string | null
  reason: ChurnReason
}

export interface AdminAnalytics {
  generatedAt: string
  monthStart: string
  metrics: AdminMetrics
  activeSubscribers: ActiveSubscriberRow[]
  recentPayments: RecentPaymentRow[]
  churned: ChurnedRow[]
}

/* ── query ──────────────────────────────────────────────────────────────────── */

// Defensive ceiling so a runaway table can never blow up the page. Well above
// any realistic subscription count for the foreseeable future.
const SUB_SCAN_LIMIT = 5000
const RECENT_PAYMENT_LIMIT = 50

// Prefer the authoritative tiyin amount; fall back to the legacy so'm column for
// rows written before amount_tiyin existed.
const amountTiyinExpr = sql<number>`COALESCE(${payments.amount_tiyin}, ROUND(${payments.amount}::numeric * 100))`

function paymentState(atmosStatus: string, legacyStatus: string): PaymentState {
  if (atmosStatus === 'success' || legacyStatus === 'paid') return 'paid'
  if (atmosStatus === 'failed' || legacyStatus === 'failed') return 'failed'
  if (atmosStatus === 'cancelled' || legacyStatus === 'cancelled') return 'cancelled'
  return 'pending'
}

// The synthetic payment the ATMOS-integration test script leaves behind
// (scripts/atmos-direct-test.mjs stamps this exact payer_email, with no user_id).
const TEST_PAYER_EMAIL = '[atmos:direct test]'

export async function getAdminAnalytics(now: Date = new Date()): Promise<AdminAnalytics> {
  const monthStart = tashkentMonthStart(now)

  // ── Founder + synthetic-row exclusion ───────────────────────────────────────
  // The founder (ADMIN_EMAIL) is testing their own product, not a customer, so
  // their rows must NEVER inflate revenue/MRR/active/funnel/plan-splits. Resolve
  // the founder's user id(s) from the email so the filter is by identity, not by
  // deleting data. Predicates are written NULL-safe: they key off payer_email
  // (which survives account deletion) and user_id, and deliberately do NOT treat
  // "user_id IS NULL" as synthetic — a deleted REAL customer also has a null
  // user_id and their past revenue is genuine.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || null
  const adminUsers = adminEmail
    ? await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${adminEmail}`)
    : []
  const adminIds = adminUsers.map(u => u.id)
  const adminIdList = adminIds.length
    ? sql.join(adminIds.map(id => sql`${id}::uuid`), sql`, `)
    : null

  // A payment counts toward revenue metrics unless it is the synthetic test row
  // or belongs to the founder (matched by email OR linked user id).
  const paymentExcludedParts = [
    sql`${payments.payer_email} IS NOT DISTINCT FROM ${TEST_PAYER_EMAIL}`,
  ]
  if (adminEmail) paymentExcludedParts.push(sql`(${payments.payer_email} IS NOT NULL AND lower(${payments.payer_email}) = ${adminEmail})`)
  if (adminIdList) paymentExcludedParts.push(sql`(${payments.user_id} IS NOT NULL AND ${payments.user_id} IN (${adminIdList}))`)
  const paymentIncluded = sql`NOT (${sql.join(paymentExcludedParts, sql` OR `)})`

  // Subscriptions are always linked to a user (NOT NULL FK); exclude the founder's.
  const subFounderOk = adminIdList ? sql`${subscriptions.user_id} NOT IN (${adminIdList})` : sql`TRUE`
  // Users table: drop the founder from every headcount/funnel figure.
  const userFounderOk = adminEmail ? sql`lower(${users.email}) <> ${adminEmail}` : sql`TRUE`

  const [subRows, revenueRows, paymentRows, userRows] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        email: users.email,
        plan: subscriptions.plan,
        interval: subscriptions.interval,
        status: subscriptions.status,
        periodEnd: subscriptions.current_period_end,
        autorenew: subscriptions.autorenew,
        createdAt: subscriptions.created_at,
        updatedAt: subscriptions.updated_at,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.user_id, users.id))
      // 'pending' = checkout opened and never settled. Not a customer.
      .where(and(ne(subscriptions.status, 'pending'), subFounderOk))
      .orderBy(desc(subscriptions.created_at))
      .limit(SUB_SCAN_LIMIT),

    // All-time + this-month revenue aggregated in SQL so it stays correct no
    // matter how many payment rows accumulate.
    db
      .select({
        allTime: sql<string>`COALESCE(SUM(${amountTiyinExpr}), 0)`,
        thisMonth: sql<string>`COALESCE(SUM(CASE WHEN COALESCE(${payments.confirmed_at}, ${payments.created_at}) >= ${monthStart}::timestamptz THEN ${amountTiyinExpr} ELSE 0 END), 0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(payments)
      .where(and(or(eq(payments.atmos_status, 'success'), eq(payments.status, 'paid')), paymentIncluded)),

    db
      .select({
        id: payments.id,
        payerEmail: payments.payer_email,
        userEmail: users.email,
        plan: payments.plan,
        periodMonths: payments.period_months,
        amount: payments.amount,
        amountTiyin: payments.amount_tiyin,
        status: payments.status,
        atmosStatus: payments.atmos_status,
        createdAt: payments.created_at,
        confirmedAt: payments.confirmed_at,
      })
      .from(payments)
      .leftJoin(users, eq(payments.user_id, users.id))
      .where(paymentIncluded)
      .orderBy(desc(payments.created_at))
      .limit(RECENT_PAYMENT_LIMIT),

    // User-base counts — registered vs paying kept as distinct figures. Trials
    // (plan 'free' + future trial_ends_at) are never counted as paying because
    // the paid filter is `plan <> 'free'`.
    db
      .select({
        total: sql<string>`COUNT(*)`,
        newThisMonth: sql<string>`COUNT(*) FILTER (WHERE ${users.created_at} >= ${monthStart}::timestamptz)`,
        paidPlan: sql<string>`COUNT(*) FILTER (WHERE ${users.plan} <> 'free' AND (${users.plan_expires_at} IS NULL OR ${users.plan_expires_at} > ${now}::timestamptz))`,
        trialing: sql<string>`COUNT(*) FILTER (WHERE ${users.plan} = 'free' AND ${users.trial_ends_at} IS NOT NULL AND ${users.trial_ends_at} > ${now}::timestamptz)`,
        grandfathered: sql<string>`COUNT(*) FILTER (WHERE ${users.is_grandfathered} = true)`,
      })
      .from(users)
      .where(userFounderOk),
  ])

  const metrics: AdminMetrics = {
    mrrTiyin: 0,
    arrTiyin: 0,
    totalRevenueTiyin: Number(revenueRows[0]?.allTime ?? 0),
    monthRevenueTiyin: Number(revenueRows[0]?.thisMonth ?? 0),
    paidPaymentCount: Number(revenueRows[0]?.count ?? 0),
    activeCount: 0,
    byPlan: { pro: { count: 0, mrrTiyin: 0 }, pro_plus: { count: 0, mrrTiyin: 0 }, biznes: { count: 0, mrrTiyin: 0 } },
    byInterval: { monthly: { count: 0, mrrTiyin: 0 }, annual: { count: 0, mrrTiyin: 0 } },
    newThisMonth: 0,
    churnedThisMonth: 0,
    pastDueCount: 0,
    totalUsers: Number(userRows[0]?.total ?? 0),
    newUsersThisMonth: Number(userRows[0]?.newThisMonth ?? 0),
    paidPlanUsers: Number(userRows[0]?.paidPlan ?? 0),
    trialUsers: Number(userRows[0]?.trialing ?? 0),
    grandfatheredUsers: Number(userRows[0]?.grandfathered ?? 0),
  }

  const activeSubscribers: ActiveSubscriberRow[] = []
  const churned: ChurnedRow[] = []

  for (const s of subRows) {
    const interval = normInterval(s.interval)
    const plan = normPlan(s.plan)
    const periodOver = s.periodEnd !== null && s.periodEnd.getTime() <= now.getTime()
    const explicitlyEnded = s.status === 'cancelled' || s.status === 'expired'
    const isActive = s.status === 'active' && !periodOver
    const isLapsed = explicitlyEnded || ((s.status === 'active' || s.status === 'past_due') && periodOver)

    if (s.createdAt >= monthStart) metrics.newThisMonth++
    if (s.status === 'past_due' && !periodOver) metrics.pastDueCount++

    if (isActive) {
      metrics.activeCount++
      const mrrTiyin = plan ? monthlyValueTiyin(plan, interval) : 0
      metrics.mrrTiyin += mrrTiyin
      if (plan) {
        metrics.byPlan[plan].count++
        metrics.byPlan[plan].mrrTiyin += mrrTiyin
      }
      metrics.byInterval[interval].count++
      metrics.byInterval[interval].mrrTiyin += mrrTiyin

      activeSubscribers.push({
        id: s.id,
        email: s.email,
        plan: s.plan,
        interval,
        amountTiyin: plan ? planAmountTiyin(plan, interval) : 0,
        mrrTiyin,
        startedAt: s.createdAt.toISOString(),
        periodEnd: s.periodEnd?.toISOString() ?? null,
        autorenew: s.autorenew,
      })
    } else if (isLapsed) {
      // Explicitly ended rows carry their end moment on updated_at; silently
      // lapsed ones lapsed the instant their paid period ran out.
      const lapsedAt = explicitlyEnded ? s.updatedAt : s.periodEnd
      const reason: ChurnReason =
        s.status === 'cancelled' ? 'cancelled' : s.status === 'expired' ? 'expired' : 'lapsed'

      if (lapsedAt && lapsedAt >= monthStart) metrics.churnedThisMonth++

      churned.push({
        id: s.id,
        email: s.email,
        plan: s.plan,
        interval,
        lapsedAt: lapsedAt?.toISOString() ?? null,
        reason,
      })
    }
  }

  metrics.arrTiyin = metrics.mrrTiyin * 12

  // Soonest renewal first — the default the admin actually wants to see.
  activeSubscribers.sort((a, b) => {
    if (a.periodEnd === b.periodEnd) return 0
    if (a.periodEnd === null) return 1
    if (b.periodEnd === null) return -1
    return a.periodEnd.localeCompare(b.periodEnd)
  })
  churned.sort((a, b) => (b.lapsedAt ?? '').localeCompare(a.lapsedAt ?? ''))

  const recentPayments: RecentPaymentRow[] = paymentRows.map(p => ({
    id: p.id,
    date: (p.confirmedAt ?? p.createdAt).toISOString(),
    // payer_email is snapshotted at payment time and survives account deletion,
    // so it identifies the payer even when the user row is gone.
    email: p.payerEmail ?? p.userEmail,
    plan: p.plan,
    interval: p.periodMonths >= 12 ? 'annual' : 'monthly',
    amountTiyin: p.amountTiyin ?? Math.round(Number(p.amount) * 100),
    state: paymentState(p.atmosStatus, p.status),
  }))

  return {
    generatedAt: now.toISOString(),
    monthStart: monthStart.toISOString(),
    metrics,
    activeSubscribers,
    recentPayments,
    churned,
  }
}
