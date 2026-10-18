import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { getConfig, AtmosConfigError } from '@/lib/billing/atmos'

const RENEW_WINDOW_MS = 24 * 60 * 60 * 1000

const OWNER_EMAILS: ReadonlySet<string> = new Set([
  'jkhakimjonov8@gmail.com',
])

function envOn(v: string | undefined): boolean {
  return /^(1|true|on|yes)$/i.test(v?.trim() || '')
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user?.email || !OWNER_EMAILS.has(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = new Date()

  // 1. All successful payments, with a flag for whether it was a renewal.
  //    A "renewal" is a successful payment whose subscription already had
  //    an earlier successful payment (by created_at).
  const successfulPayments = await db.execute<{
    id: string
    subscription_id: string | null
    created_at: string
    amount_tiyin: number | null
    plan: string
    user_id: string | null
    is_renewal: boolean
  }>(sql`
    SELECT
      p.id,
      p.subscription_id,
      p.created_at,
      p.amount_tiyin,
      p.plan,
      p.user_id,
      EXISTS (
        SELECT 1 FROM payments earlier
        WHERE earlier.subscription_id = p.subscription_id
          AND earlier.subscription_id IS NOT NULL
          AND earlier.atmos_status = 'success'
          AND earlier.created_at < p.created_at
          AND earlier.id != p.id
      ) AS is_renewal
    FROM payments p
    WHERE p.atmos_status = 'success'
    ORDER BY p.created_at DESC
  `)

  const allSuccessful = successfulPayments.rows ?? successfulPayments
  const totalSuccessful = allSuccessful.length
  const renewals = allSuccessful.filter((r: { is_renewal: boolean }) => r.is_renewal)
  const firstPayments = allSuccessful.filter((r: { is_renewal: boolean }) => !r.is_renewal)

  // 2. Failed payments (likely renewal attempts) — most recent 5 with error info.
  const failedPayments = await db.execute<{
    id: string
    subscription_id: string | null
    created_at: string
    amount_tiyin: number | null
    plan: string
    status: string
    atmos_status: string
    raw_callback: unknown
    user_id: string | null
  }>(sql`
    SELECT
      p.id,
      p.subscription_id,
      p.created_at,
      p.amount_tiyin,
      p.plan,
      p.status,
      p.atmos_status,
      p.raw_callback,
      p.user_id
    FROM payments p
    WHERE p.atmos_status = 'failed'
      AND p.subscription_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM payments earlier
        WHERE earlier.subscription_id = p.subscription_id
          AND earlier.atmos_status = 'success'
          AND earlier.created_at < p.created_at
          AND earlier.id != p.id
      )
    ORDER BY p.created_at DESC
    LIMIT 5
  `)

  const failedRenewals = failedPayments.rows ?? failedPayments

  // Count all failed renewal attempts (not just 5).
  const failedCountResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM payments p
    WHERE p.atmos_status = 'failed'
      AND p.subscription_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM payments earlier
        WHERE earlier.subscription_id = p.subscription_id
          AND earlier.atmos_status = 'success'
          AND earlier.created_at < p.created_at
          AND earlier.id != p.id
      )
  `)
  const failedRenewalCount = Number(
    (failedCountResult.rows ?? failedCountResult)[0]?.count ?? 0,
  )

  // 3. Live config state.
  const configState = {
    BILLING_AUTORENEW_DISABLED: envOn(process.env.BILLING_AUTORENEW_DISABLED),
    BILLING_RENEW_DRY_RUN: envOn(process.env.BILLING_RENEW_DRY_RUN),
    CRON_SECRET_SET: !!process.env.CRON_SECRET,
  }

  // 4. Due-subscription snapshot — how many match the renewal query right now.
  const dueBefore = new Date(now.getTime() + RENEW_WINDOW_MS)
  const dueResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM subscriptions
    WHERE status IN ('active', 'past_due')
      AND autorenew = true
      AND card_token_encrypted IS NOT NULL
      AND current_period_end < ${dueBefore}
  `)
  const dueCount = Number(
    (dueResult.rows ?? dueResult)[0]?.count ?? 0,
  )

  // 5. Downgrade impact — users on free whose subscription shows past_due
  //    (likely dropped because renewal didn't charge).
  const downgradeResult = await db.execute<{ count: string; recent: unknown[] }>(sql`
    SELECT COUNT(DISTINCT u.id)::text AS count
    FROM users u
    INNER JOIN subscriptions s ON s.user_id = u.id
    WHERE u.plan = 'free'
      AND s.status = 'past_due'
  `)
  const downgradeCount = Number(
    (downgradeResult.rows ?? downgradeResult)[0]?.count ?? 0,
  )

  // Also get users on free with a cancelled subscription that had a card bound
  // (they paid once, then something stopped).
  const lapsedPaidResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(DISTINCT u.id)::text AS count
    FROM users u
    INNER JOIN subscriptions s ON s.user_id = u.id
    WHERE u.plan = 'free'
      AND s.card_token_encrypted IS NOT NULL
      AND s.status IN ('past_due', 'cancelled', 'expired')
  `)
  const lapsedPaidCount = Number(
    (lapsedPaidResult.rows ?? lapsedPaidResult)[0]?.count ?? 0,
  )

  // 6. Renewal attempts log — real evidence of what the system tried.
  const attemptCountResult = await db.execute<{ outcome: string; count: string }>(sql`
    SELECT outcome, COUNT(*)::text AS count
    FROM renewal_attempts
    GROUP BY outcome
    ORDER BY count DESC
  `)
  const attemptCounts = (attemptCountResult.rows ?? attemptCountResult) as Array<{ outcome: string; count: string }>
  const attemptsByOutcome: Record<string, number> = {}
  for (const r of attemptCounts) attemptsByOutcome[r.outcome] = Number(r.count)

  const recentAttempts = await db.execute<{
    id: string; subscription_id: string; plan: string; interval: string;
    amount_tiyin: number | null; dry_run: boolean; outcome: string;
    atmos_transaction_id: string | null; error: string | null;
    source: string; created_at: string
  }>(sql`
    SELECT id, subscription_id, plan, interval, amount_tiyin, dry_run,
           outcome, atmos_transaction_id, error, source, created_at
    FROM renewal_attempts
    ORDER BY created_at DESC
    LIMIT 10
  `)
  const recentAttemptRows = recentAttempts.rows ?? recentAttempts

  // 8. Active subscriptions with card tokens (for renew-one testing).
  const activeSubs = await db.execute<{
    id: string; user_id: string; plan: string; interval: string;
    status: string; autorenew: boolean; has_card: boolean;
    card_last4: string | null; agreed_amount_tiyin: number | null;
    current_period_end: string | null; created_at: string;
  }>(sql`
    SELECT
      s.id, s.user_id, s.plan, s.interval, s.status, s.autorenew,
      (s.card_token_encrypted IS NOT NULL) AS has_card,
      s.card_last4, s.agreed_amount_tiyin, s.current_period_end, s.created_at
    FROM subscriptions s
    WHERE s.status IN ('active', 'past_due', 'pending')
    ORDER BY s.created_at DESC
    LIMIT 10
  `)
  const activeSubRows = (activeSubs.rows ?? activeSubs) as Array<Record<string, unknown>>

  // 9. Best candidate for renewal test — active sub with card bound.
  const renewCandidate = activeSubRows.find(
    (s) => s.has_card === true && (s.status === 'active' || s.status === 'past_due') && s.agreed_amount_tiyin,
  ) as Record<string, unknown> | undefined

  // 7. ATMOS connectivity check — config present + OAuth token works?
  let atmosCheck: Record<string, unknown>
  try {
    const cfg = getConfig()
    atmosCheck = {
      config_loaded: true,
      base_url: cfg.baseUrl,
      store_id: cfg.storeId,
      consumer_key_set: !!cfg.consumerKey,
      consumer_secret_set: !!cfg.consumerSecret,
      callback_api_key_set: !!cfg.callbackApiKey,
    }
    // Try to acquire an OAuth token to confirm credentials work.
    const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64')
    const tokenRes = await fetch(`${cfg.baseUrl}/token?grant_type=client_credentials`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: 'grant_type=client_credentials',
    })
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>
    atmosCheck.token_http_status = tokenRes.status
    atmosCheck.token_ok = tokenRes.ok && !!tokenJson.access_token
    if (!tokenRes.ok) atmosCheck.token_error = JSON.stringify(tokenJson).slice(0, 300)
  } catch (err) {
    atmosCheck = {
      config_loaded: !(err instanceof AtmosConfigError),
      error: String(err).slice(0, 300),
    }
  }

  return NextResponse.json({
    generated_at: now.toISOString(),
    read_only: true,

    '1_renewal_charge_history': {
      total_successful_payments: totalSuccessful,
      first_payments: firstPayments.length,
      renewal_payments: renewals.length,
      recent_5_successful: allSuccessful.slice(0, 5).map((r: Record<string, unknown>) => ({
        id: r.id,
        created_at: r.created_at,
        amount_tiyin: r.amount_tiyin,
        plan: r.plan,
        type: r.is_renewal ? 'renewal' : 'first_payment',
      })),
    },

    '2_failed_renewals': {
      total_failed_renewal_attempts: failedRenewalCount,
      recent_5: (failedRenewals as Array<Record<string, unknown>>).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        amount_tiyin: r.amount_tiyin,
        plan: r.plan,
        status: r.status,
        atmos_status: r.atmos_status,
        raw_callback_snippet: r.raw_callback
          ? JSON.stringify(r.raw_callback).slice(0, 300)
          : null,
      })),
    },

    '3_live_config': configState,

    '4_due_subscriptions': {
      count: dueCount,
      window_hours: RENEW_WINDOW_MS / (60 * 60 * 1000),
      as_of: now.toISOString(),
    },

    '5_downgrade_impact': {
      users_free_with_past_due_subscription: downgradeCount,
      users_free_with_any_card_bound_subscription: lapsedPaidCount,
    },

    '6_renewal_attempts': {
      by_outcome: attemptsByOutcome,
      total: Object.values(attemptsByOutcome).reduce((a, b) => a + b, 0),
      recent_10: (recentAttemptRows as Array<Record<string, unknown>>).map((r) => ({
        id: r.id,
        subscription_id: r.subscription_id,
        plan: r.plan,
        amount_tiyin: r.amount_tiyin,
        dry_run: r.dry_run,
        outcome: r.outcome,
        atmos_transaction_id: r.atmos_transaction_id,
        error: r.error ? String(r.error).slice(0, 300) : null,
        source: r.source,
        created_at: r.created_at,
      })),
    },

    '7_atmos_connectivity': atmosCheck,

    '8_active_subscriptions': activeSubRows,

    '9_renewal_test': renewCandidate
      ? {
          ready: true,
          subscription_id: renewCandidate.id,
          plan: renewCandidate.plan,
          interval: renewCandidate.interval,
          agreed_amount_tiyin: renewCandidate.agreed_amount_tiyin,
          card_last4: renewCandidate.card_last4,
          status: renewCandidate.status,
          dry_run_fetch: `fetch('/api/billing/renew-one',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription_id:'${renewCandidate.id}'})}).then(r=>r.json()).then(console.log)`,
          live_charge_fetch: `fetch('/api/billing/renew-one',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription_id:'${renewCandidate.id}',confirm:true})}).then(r=>r.json()).then(console.log)`,
        }
      : {
          ready: false,
          reason: 'No active/past_due subscription with card bound and agreed_amount_tiyin. Cards bound: ' +
            activeSubRows.filter((s) => s.has_card === true).length + '/' + activeSubRows.length,
        },
  })
}
