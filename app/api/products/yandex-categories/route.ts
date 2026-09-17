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

  // Strategy 2: Fetch full category tree and keyword-search
  try {
    const tree = await fetchYandexCategories(token)
    const flat = flattenCategories(tree)
    const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2)
    if (words.length === 0) {
      return NextResponse.json({ categories: [] })
    }
    const adultStems = ['мужск', 'женск', 'взросл', 'мужчин', 'женщин']
    const childStems = ['детск', 'для детей', 'для мальчик', 'для девоч', 'малыш', 'младен', 'ребёнк', 'ребенк']
    const queryLc = query.trim().toLowerCase()
    const queryImpliesAdult = adultStems.some(s => queryLc.includes(s))
    const queryImpliesChild = childStems.some(s => queryLc.includes(s))

    const synonymMap: Record<string, string[]> = {
      'мужск': ['для взрослых', 'мужск', 'мужчин'],
      'женск': ['для взрослых', 'женск', 'женщин'],
      'взросл': ['для взрослых', 'мужск', 'женск'],
      'детск': ['детск', 'для детей', 'для мальчик', 'для девоч'],
    }

    const scored = flat
      .map(c => {
        const text = `${c.name} ${c.path}`.toLowerCase()
        let hits = words.filter(w => text.includes(w)).length

        for (const w of words) {
          if (hits > 0 || text.includes(w)) {
            const syns = Object.entries(synonymMap).find(([stem]) => w.includes(stem))
            if (syns) {
              const bonus = syns[1].some(syn => text.includes(syn)) ? 1 : 0
              hits += bonus
            }
          }
        }

        if (queryImpliesAdult && !queryImpliesChild) {
          if (childStems.some(s => text.includes(s))) hits = 0
        } else if (queryImpliesChild && !queryImpliesAdult) {
          if (adultStems.some(s => text.includes(s)) && !childStems.some(s => text.includes(s))) hits = 0
        }

        return { ...c, hits }
      })
      .filter(c => c.hits > 0)
      .sort((a, b) => b.hits - a.hits || a.name.length - b.name.length)
      .slice(0, 20)
    return NextResponse.json({ categories: scored })
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
