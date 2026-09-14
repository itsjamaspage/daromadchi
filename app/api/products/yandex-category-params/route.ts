import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'
import { fetchCategoryParameters } from '@/lib/yandex/client'

export const runtime = 'nodejs'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { categoryId } = (await req.json()) as { categoryId?: number }
  if (!categoryId || typeof categoryId !== 'number') {
    return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
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
  const params = await fetchCategoryParameters(token, categoryId)

  return NextResponse.json({ parameters: params })
})
