import { NextRequest, NextResponse } from 'next/server'
import { asc, inArray, count } from 'drizzle-orm'
import { db, products } from '@/lib/db'
import { getExtensionUser, getShopIds } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const shopIdParam = searchParams.get('shopId')
  const page = Math.max(0, Number(searchParams.get('page') ?? 0))
  const size = Math.min(200, Math.max(1, Number(searchParams.get('size') ?? 50)))

  const shopIds = await getShopIds(user.id, shopIdParam)
  if (shopIds.length === 0) return NextResponse.json({ products: [], total: 0 })

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: products.id,
      title: products.title,
      sku: products.sku,
      selling_price: products.selling_price,
      cost_price: products.cost_price,
      stock_quantity: products.stock_quantity,
      category: products.category,
      marketplace_product_id: products.marketplace_product_id,
    }).from(products)
      .where(inArray(products.shop_id, shopIds))
      .orderBy(asc(products.stock_quantity))
      .limit(size)
      .offset(page * size),
    db.select({ total: count() }).from(products).where(inArray(products.shop_id, shopIds)),
  ])

  const productsOut = rows.map(p => ({
    id:           p.id,
    name:         p.title,
    sku:          p.sku,
    stock:        p.stock_quantity,
    sellingPrice: Number(p.selling_price ?? 0),
    // null, not 0 — the extension's unit-economics panel prefills from this,
    // and a zero would quietly present itself as a real purchase price.
    costPrice:    p.cost_price != null ? Number(p.cost_price) : null,
    category:     p.category,
    productId:    p.marketplace_product_id,
    // Fields needed by extension alert rules — computed from available data
    hasActiveAd:  false,
    adSpendToday: 0,
    salesToday:   0,
    salesDropPct: 0,
    returnRate:   0,
    newReviews:   0,
  }))

  return NextResponse.json({ products: productsOut, total })
})
