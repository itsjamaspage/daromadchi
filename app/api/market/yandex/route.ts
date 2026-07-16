import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { fetchYandexCategories, fetchCategoryModels, searchYandexModels, YandexApiError } from '@/lib/yandex/client'
import { decrypt as decryptKey } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const action     = searchParams.get('action') ?? 'categories'
  const categoryId = searchParams.get('categoryId')

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Autentifikatsiya talab etiladi' }, { status: 401 })
  }

  const [shop] = await db.select({
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market')))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json(
      { error: 'Yandex API token topilmadi. Sozlamalarda Yandex tokeningizni saqlang.' },
      { status: 400 }
    )
  }

  const token = decryptKey(shop.api_key_encrypted)

  try {
    if (action === 'categories') {
      const categories = await fetchYandexCategories(token)
      return NextResponse.json({ categories }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600' },
      })
    }

    if (action === 'models' && categoryId) {
      const id     = parseInt(categoryId, 10)
      const sort   = (searchParams.get('sort') ?? 'OPINIONS') as 'OPINIONS' | 'PRICE' | 'QUALITY'
      const models = await fetchCategoryModels(token, id, 30, sort)
      return NextResponse.json({ models }, {
        headers: { 'Cache-Control': 'public, s-maxage=300' },
      })
    }

    if (action === 'search') {
      const q    = searchParams.get('q') ?? ''
      const sort = (searchParams.get('sort') ?? 'OPINIONS') as 'OPINIONS' | 'PRICE' | 'QUALITY'
      const models = await searchYandexModels(token, q, 30, sort)
      return NextResponse.json({ models }, {
        headers: { 'Cache-Control': 'public, s-maxage=120' },
      })
    }

    return NextResponse.json({ error: 'action veya categoryId talab etiladi' }, { status: 400 })
  } catch (err) {
    if (err instanceof YandexApiError) {
      return NextResponse.json(
        { error: err.message, detail: err.body, httpStatus: err.status },
        { status: err.status >= 400 ? err.status : 500 },
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
