import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or, ilike, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'q parameter required (min 2 chars)' }, { status: 400 })
  }

  const userShops = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.is_active, true)))

  const shopIds = userShops.map(s => s.id)
  if (shopIds.length === 0) {
    return NextResponse.json({ ok: true, matches: [], shopCount: 0 })
  }

  const shopMap = new Map(userShops.map(s => [s.id, s.marketplace]))
  const pattern = `%${q}%`

  const rows = await db.select({
    id: products.id,
    shop_id: products.shop_id,
    sku: products.sku,
    title: products.title,
    marketplace_product_id: products.marketplace_product_id,
    stock_quantity: products.stock_quantity,
    selling_price: products.selling_price,
    is_archived: products.is_archived,
    moderation_status: products.moderation_status,
    market_barcode: products.market_barcode,
    market_sku: products.market_sku,
    variant_group_key: products.variant_group_key,
    image_url: products.image_url,
    updated_at: products.updated_at,
  }).from(products)
    .where(and(
      sql`${products.shop_id} = ANY(${sql`string_to_array(${shopIds.join(',')}, ',')::uuid[]`})`,
      or(
        ilike(products.sku, pattern),
        ilike(products.title, pattern),
        ilike(products.marketplace_product_id, pattern),
      ),
    ))
    .limit(50)

  return NextResponse.json({
    ok: true,
    query: q,
    shopCount: shopIds.length,
    matchCount: rows.length,
    matches: rows.map(r => ({
      id: r.id,
      marketplace: shopMap.get(r.shop_id),
      shop_id: r.shop_id,
      sku: r.sku,
      title: r.title,
      marketplace_product_id: r.marketplace_product_id,
      stock_quantity: r.stock_quantity,
      selling_price: r.selling_price ? Number(r.selling_price) : null,
      is_archived: r.is_archived,
      moderation_status: r.moderation_status,
      market_barcode: r.market_barcode,
      market_sku: r.market_sku,
      variant_group_key: r.variant_group_key,
      image_url: r.image_url,
      updated_at: r.updated_at?.toISOString(),
    })),
  })
})
