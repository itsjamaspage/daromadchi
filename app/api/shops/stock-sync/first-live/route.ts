import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { firstLivePush } from '@/lib/marketplace/stock-sync'

const Schema = z.object({ productId: z.string().uuid() })

// GATE 2 — the controlled first live write: one hand-picked product, pushed LIVE,
// then read back from the store to prove the marketplace actually shows the new
// number (a bare HTTP 200 is not trusted). Requires the product's shop to belong
// to the caller and be in stock_sync mode.
export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'productId (uuid) required' }, { status: 400 })

  // Ownership check: the product must live in one of the caller's shops.
  const userShops = await db.select({ id: shops.id }).from(shops).where(eq(shops.user_id, user.id))
  const shopIds = userShops.map(s => s.id)
  const [owned] = shopIds.length
    ? await db.select({ id: products.id }).from(products)
        .where(and(eq(products.id, parsed.data.productId), inArray(products.shop_id, shopIds)))
    : []
  if (!owned) return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 })

  const result = await firstLivePush(user.id, parsed.data.productId)
  return NextResponse.json({ ok: result.status === 'sent' && result.verified, ...result })
})
