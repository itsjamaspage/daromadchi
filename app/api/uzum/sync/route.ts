import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { syncFromUzum } from '@/lib/uzum/sync'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Avtorizatsiya talab etiladi' }, { status: 401 })
  }

  const [shop] = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json(
      { ok: false, error: 'Uzum API token topilmadi. Sozlamalar sahifasida tokenni kiriting.' },
      { status: 400 },
    )
  }

  try {
    const token = decrypt(shop.api_key_encrypted)
    const result = await syncFromUzum(shop.id, token)
    if (!result.ok) logger.warn('uzum_sync_error', { shopId: shop.id, error: result.error })
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    logger.error('uzum_sync_unhandled', { shopId: shop.id, error: String(err) })
    return NextResponse.json({ ok: false, error: 'Sync xatosi yuz berdi' }, { status: 500 })
  }
})

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }

  try {
    const token = decrypt(shop.api_key_encrypted)
    const res = await fetch('https://api-seller.uzum.uz/api/seller-openapi/v1/shops', {
      headers: { Authorization: token, Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      return NextResponse.json({ ok: true, message: `Uzum token ishlayapti — sinxronizatsiyani boshlashingiz mumkin` })
    }
    // 429 = rate limited, NOT a bad token. Say so instead of "token invalid".
    if (res.status === 429) {
      return NextResponse.json({
        ok: false,
        error: `Uzum so'rovlar chegarasiga yetdingiz (429). Token to'g'ri — 1-2 daqiqa kuting va qaytadan urinib ko'ring.`,
      })
    }
    // 401/403 = auth/permission problem — that's the "wrong token" case.
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    const authIssue = res.status === 401 || res.status === 403
    return NextResponse.json({
      ok: false,
      error: authIssue
        ? `Uzum token noto'g'ri yoki ruxsat yo'q (${res.status}). seller.uzum.uz → Sozlamalar → API integratsiya sahifasidan API kalitini qayta nusxalab saqlang.`
        : `Uzum xatosi (${res.status}). Birozdan so'ng qaytadan urinib ko'ring.`,
      detail: body.slice(0, 300),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tarmoq xatosi: ${String(err)}` })
  }
})
