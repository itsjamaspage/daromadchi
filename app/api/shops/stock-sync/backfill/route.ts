import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { backfillShopIdentifiers } from '@/lib/marketplace/identifier-backfill'

// GATE 1 — populate the stock-WRITE identifiers (Uzum barcode / YM shopSku +
// warehouseId) from READ-only endpoints. This never calls the stock-writer and
// can never fire a live write. Run this, then inspect `missingAfter` before any
// shop flips out of dry-run. Uzum + Yandex Market only.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
  }).from(shops).where(and(
    eq(shops.user_id, user.id),
    eq(shops.is_active, true),
    inArray(shops.marketplace, ['uzum', 'yandex_market']),
  ))

  const results = []
  for (const shop of rows) {
    results.push(await backfillShopIdentifiers(shop))
  }

  const missingTotal = results.reduce((s, r) => s + r.missingAfter, 0)
  return NextResponse.json({
    ok: true,
    // The gate: identifiers are fully populated only when this is 0.
    readyForLive: missingTotal === 0,
    missingTotal,
    results,
  })
})
