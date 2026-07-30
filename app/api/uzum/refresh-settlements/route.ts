import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { syncUzumSettlements } from '@/lib/uzum/settlements-sync'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
// Uzum's finance endpoint is fast (~seconds) but we still allow a
// wide budget so a slow paginated pull doesn't get killed mid-run.
export const maxDuration = 120

// User-triggered refresh from the Payouts page "Refresh Uzum" kebab
// action. Kicks off syncUzumSettlements for every Uzum shop the user
// owns. Idempotent — safe to spam-click.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const uzShops = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops).where(and(
    eq(shops.user_id, user.id),
    eq(shops.marketplace, 'uzum'),
  ))

  if (uzShops.length === 0) {
    return NextResponse.json({ ok: false, error: 'No Uzum shop connected.' }, { status: 404 })
  }

  const results = []
  for (const s of uzShops) {
    if (!s.api_key_encrypted) {
      results.push({ shopId: s.id, ok: false, error: 'shop is missing token' })
      continue
    }
    try {
      const token = decrypt(s.api_key_encrypted)
      const r = await syncUzumSettlements(s.id, token)
      results.push({ shopId: s.id, ...r })
    } catch (e) {
      results.push({ shopId: s.id, ok: false, error: String(e).slice(0, 2000) })
    }
  }

  return NextResponse.json({ ok: true, results })
})
