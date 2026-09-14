import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'
import { fetchYandexCategories, type YandexCategory } from '@/lib/yandex/client'

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
    .select({ api_key_encrypted: shops.api_key_encrypted })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))
    .limit(1)

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'No Yandex token found' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)
  const tree = await fetchYandexCategories(token)
  const flat = flattenCategories(tree)

  const q = query.trim().toLowerCase()
  const matches = flat
    .filter(c => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))
    .slice(0, 20)

  return NextResponse.json({ categories: matches })
})
