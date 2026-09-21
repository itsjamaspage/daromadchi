/**
 * Auto-renewal cron. ATMOS has no native recurring, so we charge the stored card
 * token for subscriptions about to expire.
 *
 * BILLING_RENEW_DRY_RUN=1 logs what it WOULD charge without charging.
 * BILLING_AUTORENEW_DISABLED=1 turns auto-renew off (kill-switch for emergencies).
 *
 * This file is auth + flags only. The renewal rules — what to charge, what to
 * skip, what a failure does — live in lib/billing/renew.ts so they can be driven
 * from a test against a real database and a fake gateway.
 */

import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { runBillingRenewal } from '@/lib/billing/renew'

export const runtime = 'nodejs'
export const maxDuration = 300

function envOn(v: string | undefined): boolean {
  return /^(1|true|on|yes)$/i.test(v?.trim() || '')
}

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (envOn(process.env.BILLING_AUTORENEW_DISABLED)) {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  const summary = await runBillingRenewal({ dryRun: envOn(process.env.BILLING_RENEW_DRY_RUN) })
  return NextResponse.json({ ok: true, ...summary })
})
