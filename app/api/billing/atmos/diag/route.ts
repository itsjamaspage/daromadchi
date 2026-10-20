/**
 * GET /api/billing/atmos/diag
 *
 * Temporary diagnostic endpoint (auth-protected) to check ATMOS bind config
 * and recent callback/subscription state without needing VPS access.
 * DELETE THIS FILE after debugging is complete.
 */

import { NextResponse } from 'next/server'
import { eq, desc, and } from 'drizzle-orm'
import { db, payments, subscriptions } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { getConfig, AtmosConfigError } from '@/lib/billing/atmos'
import { _debugLastCallback } from '../callback/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const diag: Record<string, unknown> = {}

  // 1. Config check
  try {
    const cfg = getConfig()
    diag.config = {
      hasBindCallbackApiKey: !!cfg.bindCallbackApiKey,
      bindCallbackApiKeyLength: cfg.bindCallbackApiKey.length,
      ipAllowlistEnabled: cfg.ipAllowlistEnabled,
      storeId: cfg.storeId,
    }
  } catch (err) {
    diag.config = {
      error: err instanceof AtmosConfigError ? err.message : 'unknown',
    }
  }

  // 2. NEXT_PUBLIC_APP_URL check
  diag.appUrl = process.env.NEXT_PUBLIC_APP_URL || '(not set, defaults to https://daromadchi.uz)'

  // 3. Recent pending subscriptions
  const pendingSubs = await db.select({
    id: subscriptions.id,
    userId: subscriptions.user_id,
    status: subscriptions.status,
    card_id: subscriptions.card_id,
    plan: subscriptions.plan,
    created_at: subscriptions.created_at,
  }).from(subscriptions)
    .where(eq(subscriptions.status, 'pending'))
    .orderBy(desc(subscriptions.created_at))
    .limit(5)

  diag.pendingSubscriptions = pendingSubs.map(s => ({
    id: s.id,
    isCurrentUser: s.userId === user.id,
    hasCardId: !!s.card_id,
    cardIdPrefix: s.card_id ? s.card_id.slice(0, 6) + '...' : null,
    plan: s.plan,
    created_at: s.created_at,
  }))

  // 4. Recent payments for this user
  const recentPayments = await db.select({
    id: payments.id,
    status: payments.status,
    atmos_status: payments.atmos_status,
    atmos_payment_id: payments.atmos_payment_id,
    amount_tiyin: payments.amount_tiyin,
    provider: payments.provider,
    raw_callback: payments.raw_callback,
    subscription_id: payments.subscription_id,
    created_at: payments.created_at,
  }).from(payments)
    .where(eq(payments.user_id, user.id))
    .orderBy(desc(payments.created_at))
    .limit(5)

  diag.recentPayments = recentPayments.map(p => ({
    id: p.id,
    status: p.status,
    atmosStatus: p.atmos_status,
    hasAtmosPaymentId: !!p.atmos_payment_id,
    amountTiyin: p.amount_tiyin,
    provider: p.provider,
    subscriptionId: p.subscription_id,
    chargeError: (p.raw_callback as Record<string, unknown>)?._chargeError ?? null,
    chargeFailedAt: (p.raw_callback as Record<string, unknown>)?._chargeFailedAt ?? null,
    created_at: p.created_at,
  }))

  // 5. Last callback attempts (in-memory debug capture)
  diag.lastCallbacks = _debugLastCallback

  return NextResponse.json(diag)
}
