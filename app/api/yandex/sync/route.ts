import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { syncFromYandex } from '@/lib/yandex/sync'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

function fromDaysToDate(fromDays: unknown): Date | undefined {
  if (typeof fromDays !== 'number') return undefined
  if (fromDays === 0) return new Date('2025-04-07')
  const d = new Date(); d.setDate(d.getDate() - fromDays); return d
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autentifikatsiya talab etiladi' }, { status: 401 })
  }

  const [shop] = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Yandex API token topilmadi. Avval sozlamalarda tokenni saqlang.' }, { status: 400 })
  }

  if (!shop?.shop_id_external) {
    return NextResponse.json({ ok: false, error: 'Yandex Campaign ID topilmadi. Avval sozlamalarda Campaign ID saqlang.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const fromDate = fromDaysToDate(body?.fromDays)

  try {
    const token  = decrypt(shop.api_key_encrypted)
    const result = await syncFromYandex(shop.id, token, shop.shop_id_external, fromDate)
    if (!result.ok) logger.warn('yandex_sync_error', { shopId: shop.id, error: result.error })
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    logger.error('yandex_sync_unhandled', { shopId: shop.id, error: String(err) })
    return NextResponse.json({ ok: false, error: 'Sync xatosi yuz berdi' }, { status: 500 })
  }
})

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }
  if (!shop?.shop_id_external) {
    return NextResponse.json({ ok: false, error: 'Campaign ID topilmadi' }, { status: 400 })
  }

  try {
    const token = decrypt(shop.api_key_encrypted)
    const res = await fetch(
      `https://api.partner.market.yandex.ru/v2/campaigns/${shop.shop_id_external}/orders?pageSize=1`,
      {
        headers: { 'Api-Key': token, Accept: 'application/json' },
        next: { revalidate: 0 },
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json(
        { ok: false, error: `Token noto'g'ri yoki Campaign ID noto'g'ri (${res.status})`, detail: body.slice(0, 200) },
      )
    }
    return NextResponse.json({ ok: true, message: "Yandex token ishlayapti — sinxronizatsiyani boshlashingiz mumkin" })
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tarmoq xatosi: ${String(err)}` })
  }
})
