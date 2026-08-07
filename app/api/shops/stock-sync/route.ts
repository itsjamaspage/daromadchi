import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

// Persists the per-shop Stock-sync (edit) posture. This route writes ONLY to
// Daromadchi's own `shops` row — it never touches a marketplace API. The actual
// marketplace stock write lives exclusively in lib/marketplace/stock-writer.ts
// (Phase 2). Scope: Uzum + Yandex Market only (no Wildberries).
const StockSyncSchema = z.object({
  marketplace:   z.enum(['uzum', 'yandex_market']),
  api_mode:      z.enum(['read_only', 'stock_sync']),
  oversell_mode: z.enum(['lock_last_unit', 'partition', 'off']).optional(),
  // Must be true to switch a shop INTO stock_sync for the first time.
  consent:       z.boolean().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = StockSyncSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { marketplace, api_mode, oversell_mode, consent } = parsed.data

  const [shop] = await db.select({
    id: shops.id,
    api_mode: shops.api_mode,
    stock_sync_consent_at: shops.stock_sync_consent_at,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, marketplace), eq(shops.is_active, true)))

  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Shop not connected. Save your API token first.' }, { status: 400 })
  }

  const enabling = api_mode === 'stock_sync' && shop.api_mode !== 'stock_sync'

  // Consent is required to turn edit mode ON for the first time. Re-affirming
  // an already-consented shop doesn't need the checkbox again.
  if (enabling && !shop.stock_sync_consent_at && consent !== true) {
    return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 })
  }

  const update: Record<string, unknown> = { api_mode }
  if (oversell_mode) update.oversell_mode = oversell_mode

  // Opting a shop into stock_sync makes its cross-store stock writes LIVE
  // immediately — there is no dry-run step. Consent (above) is the gate.
  if (enabling && !shop.stock_sync_consent_at) {
    update.stock_sync_consent_at = new Date()
  }

  await db.update(shops).set(update).where(eq(shops.id, shop.id))

  logger.info('stock_sync_mode_updated', {
    userId: user.id,
    marketplace,
    api_mode,
    enabling,
  })

  return NextResponse.json({
    ok: true,
    api_mode,
    consented: !!(update.stock_sync_consent_at ?? shop.stock_sync_consent_at),
  })
})
