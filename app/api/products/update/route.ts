import { NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const productId: string = body.productId
  const costPrice: number | null = body.costPrice ?? null

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
  if (costPrice !== null && (costPrice < 0 || !Number.isFinite(costPrice))) {
    return NextResponse.json({ error: 'costPrice must be a non-negative number' }, { status: 400 })
  }

  const shopRows = await db.select({ id: shops.id }).from(shops)
    .where(eq(shops.user_id, user.id))
  const shopIds = shopRows.map(s => s.id)
  if (shopIds.length === 0) return NextResponse.json({ error: 'No shops' }, { status: 400 })

  const result = await db.update(products)
    .set({ cost_price: costPrice !== null ? String(costPrice) : null })
    .where(and(eq(products.id, productId), inArray(products.shop_id, shopIds)))
    .returning({ id: products.id })

  if (result.length === 0) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
})
