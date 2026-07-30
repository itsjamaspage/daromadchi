import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { syncYandexSettlements } from '@/lib/yandex/settlements-sync'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
// Yandex's report generation can take several minutes.
export const maxDuration = 300

// User-triggered refresh from the Payouts page "Refresh Yandex" button.
// Kicks off syncYandexSettlements for every Yandex shop the user owns.
// Idempotent — safe to spam-click; each call re-generates the report.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const ymShops = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
  }).from(shops).where(and(
    eq(shops.user_id, user.id),
    eq(shops.marketplace, 'yandex_market'),
  ))

  if (ymShops.length === 0) {
    return NextResponse.json({ ok: false, error: 'No Yandex Market shop connected.' }, { status: 404 })
  }

  const results = []
  for (const s of ymShops) {
    if (!s.api_key_encrypted || !s.shop_id_external) {
      results.push({ shopId: s.id, ok: false, error: 'shop is missing token or campaign id' })
      continue
    }
    try {
      const token = decrypt(s.api_key_encrypted)
      const r = await syncYandexSettlements(s.id, token, s.shop_id_external)
      results.push({ shopId: s.id, ...r })
    } catch (e) {
      // 2000-char slice (not 300) so a DB error's full statement +
      // reason survives — the tooltip renders long text fine.
      results.push({ shopId: s.id, ok: false, error: String(e).slice(0, 2000) })
    }
  }

  // Invalidate the cache tag shared by Dashboard KPIs, P&L, and Payouts
  // so a manual refresh flips all three pages to the new numbers on the
  // next request instead of waiting out the 30s revalidate window.
  revalidateTag('settlements', { expire: 0 })

  return NextResponse.json({ ok: true, results })
})
