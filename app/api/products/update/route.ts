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
  const productId: string = body.productId
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  // Every field is OPTIONAL and distinguished from an explicit null: `null`
  // means "clear this value", an absent key means "leave it alone". Collapsing
  // the two would make a request that edits only the price silently wipe the
  // cost, since the old `?? null` read an absent key as a clear.
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  const nonNegative = (v: unknown, integer = false) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && (!integer || Number.isInteger(v)))

  if (has('costPrice') && !nonNegative(body.costPrice)) {
    return NextResponse.json({ error: 'costPrice must be a non-negative number or null' }, { status: 400 })
  }
  if (has('priceOverride') && !nonNegative(body.priceOverride)) {
    return NextResponse.json({ error: 'priceOverride must be a non-negative number or null' }, { status: 400 })
  }
  if (has('stockOverride') && !nonNegative(body.stockOverride, true)) {
    return NextResponse.json({ error: 'stockOverride must be a non-negative integer or null' }, { status: 400 })
  }

  // priceOverride / stockOverride are LOCAL DISPLAY values (migration 083).
  // Nothing reads them to build a marketplace request — the one sanctioned
  // outbound write keys off products.stock_quantity, which this never touches.
  const patch: Record<string, unknown> = {}
  if (has('costPrice'))     patch.cost_price     = body.costPrice     !== null ? String(body.costPrice)     : null
  if (has('priceOverride')) patch.price_override = body.priceOverride !== null ? String(body.priceOverride) : null
  if (has('stockOverride')) patch.stock_override = body.stockOverride

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const shopRows = await db.select({ id: shops.id }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.is_active, true)))
  const shopIds = shopRows.map(s => s.id)
  if (shopIds.length === 0) return NextResponse.json({ error: 'No shops' }, { status: 400 })

  // Ownership lives in the WHERE clause, not a prior read — a product
  // belonging to someone else matches nothing and 404s.
  const result = await db.update(products)
    .set(patch)
    .where(and(eq(products.id, productId), inArray(products.shop_id, shopIds)))
    .returning({ id: products.id })

  if (result.length === 0) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  revalidateTag('product-data', { expire: 0 })

  return NextResponse.json({ ok: true })
})
