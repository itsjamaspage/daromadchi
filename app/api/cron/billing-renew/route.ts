/**
 * Auto-renewal cron. ATMOS has no native recurring, so we charge the stored card
 * token for subscriptions about to expire.
 *
 * DISABLED by default — set BILLING_AUTORENEW_ENABLED=1 only after the direct flow
 * is validated in prod. BILLING_RENEW_DRY_RUN=1 logs what it WOULD charge without
 * charging.
 *
 * This file is auth + flags only. The renewal rules — what to charge, what to
 * skip, what a failure does — live in lib/billing/renew.ts so they can be driven
 * from a test against a real database and a fake gateway before the flag above
 * is ever flipped against live cards.
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
  if (!envOn(process.env.BILLING_AUTORENEW_ENABLED)) {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  const summary = await runBillingRenewal({ dryRun: envOn(process.env.BILLING_RENEW_DRY_RUN) })
  return NextResponse.json({ ok: true, ...summary })
})
