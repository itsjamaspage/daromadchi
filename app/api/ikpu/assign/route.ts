import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { db, products, shops } from '@/lib/db'

export const runtime = 'nodejs'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { productId, ikpuCode } = body as { productId: string; ikpuCode: string | null }

  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }
  if (ikpuCode !== null && (typeof ikpuCode !== 'string' || !/^\d{17}$/.test(ikpuCode))) {
    return NextResponse.json({ error: 'ikpuCode must be a 17-digit string or null' }, { status: 400 })
  }

  const userShops = await db.select({ id: shops.id })
    .from(shops)
    .where(eq(shops.user_id, user.id))

  if (userShops.length === 0) {
    return NextResponse.json({ error: 'no shops' }, { status: 403 })
  }

  const shopIds = userShops.map(s => s.id)
  const updated = await db.update(products)
    .set({ ikpu_code: ikpuCode })
    .where(and(eq(products.id, productId), inArray(products.shop_id, shopIds)))
    .returning({ id: products.id })

  if (updated.length === 0) {
    return NextResponse.json({ error: 'product not found or not yours' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, productId: updated[0].id, ikpuCode })
})
