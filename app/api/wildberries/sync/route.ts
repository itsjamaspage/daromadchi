import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { syncFromWildberries } from '@/lib/wildberries/sync'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

function fromDaysToDate(fromDays: unknown): Date | undefined {
  if (typeof fromDays !== 'number') return undefined
  if (fromDays === 0) return new Date('2022-02-01')
  const d = new Date(); d.setDate(d.getDate() - fromDays); return d
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
    last_synced_at: shops.last_synced_at,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'wildberries'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'No Wildberries API token saved' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const fromDate = fromDaysToDate(body?.fromDays)

  try {
    const result = await syncFromWildberries(null, shop.id, decrypt(shop.api_key_encrypted), fromDate)
    if (!result.ok) logger.warn('wb_sync_error', { shopId: shop.id, errors: result.errors })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('wb_sync_unhandled', { shopId: shop.id, error: String(err) })
    return NextResponse.json({ ok: false, error: 'Sync xatosi yuz berdi' }, { status: 500 })
  }
})

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'wildberries'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  try {
    const res = await fetch('https://common-api.wildberries.ru/api/v1/seller-info', {
      headers: { 'Authorization': token }
    })
    if (res.ok) {
      const info = await res.json()
      return NextResponse.json({
        ok: true,
        message: `Ulandi! Sotuvchi: ${info.supplierName || info.name || 'Wildberries'}`,
      })
    }
    if (res.status === 403) {
      return NextResponse.json({
        ok: false,
        error: 'IP-whitelist xatosi (403). Token faqat muayyan IP-dan foydalanish uchun sozlangan. Wildberries kabinetida IP cheklovini olib tashlang yoki yangi token yarating.',
      })
    }
    return NextResponse.json({ ok: false, error: `WB API xatosi: HTTP ${res.status}` })
  } catch {
    return NextResponse.json({ ok: false, error: 'WB API bilan bog\'lanishda xato' })
  }
})
