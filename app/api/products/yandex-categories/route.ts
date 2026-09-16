import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'
import {
  fetchYandexCategories,
  suggestYandexCategories,
  YandexApiError,
  type YandexCategory,
} from '@/lib/yandex/client'

export const runtime = 'nodejs'

function flattenCategories(cats: YandexCategory[], parentPath = ''): { id: number; name: string; path: string }[] {
  const result: { id: number; name: string; path: string }[] = []
  for (const c of cats) {
    const path = parentPath ? `${parentPath} > ${c.name}` : c.name
    result.push({ id: c.id, name: c.name, path })
    if (c.children?.length) {
      result.push(...flattenCategories(c.children, path))
    }
  }
  return result
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query } = (await req.json()) as { query?: string }
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }

  const [shop] = await db
    .select({ api_key_encrypted: shops.api_key_encrypted, business_id: shops.business_id })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))
    .limit(1)

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'Yandex Market магазин не подключён' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  // Strategy 1: Use business-level category suggestions (more reliable)
  const bizId = shop.business_id ? Number(shop.business_id) : 0
  if (bizId) {
    try {
      const suggestions = await suggestYandexCategories(token, bizId, query.trim())
      if (suggestions.length > 0) {
        return NextResponse.json({
          categories: suggestions.map(s => ({ id: s.id, name: s.name, path: s.name })),
        })
      }
    } catch (err) {
      console.error('[yandex-categories] suggestion endpoint failed, trying tree', err)
    }
  }

  // Strategy 2: Fetch full category tree and filter client-side
  try {
    const tree = await fetchYandexCategories(token)
    const flat = flattenCategories(tree)
    const q = query.trim().toLowerCase()
    const matches = flat
      .filter(c => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))
      .slice(0, 20)
    return NextResponse.json({ categories: matches })
  } catch (err) {
    console.error('[yandex-categories] tree fetch failed', err)
    if (err instanceof YandexApiError) {
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json({ error: 'Yandex токен недействителен — обновите в настройках' }, { status: 401 })
      }
      return NextResponse.json({ error: `Yandex API ошибка (${err.status})` }, { status: 502 })
    }
    const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: `Ошибка поиска категорий: ${msg}` }, { status: 500 })
  }
})
