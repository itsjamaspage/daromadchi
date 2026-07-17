import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sku: string = body.sku
  const physical_stock: number | null = body.physical_stock ?? null

  if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
  if (physical_stock !== null && (physical_stock < 0 || !Number.isInteger(physical_stock))) {
    return NextResponse.json({ error: 'physical_stock must be a non-negative integer' }, { status: 400 })
  }

  const shopRows = await db.select({ id: shops.id }).from(shops)
    .where(eq(shops.user_id, user.id))
  const shopIds = shopRows.map(s => s.id)
  if (shopIds.length === 0) return NextResponse.json({ ok: true })

  await db.update(products)
    .set({ physical_stock })
    .where(and(inArray(products.shop_id, shopIds), eq(products.sku, sku)))

  revalidateTag('product-data', 'max')

  return NextResponse.json({ ok: true })
})
