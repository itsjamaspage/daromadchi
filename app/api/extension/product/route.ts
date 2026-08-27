import { NextRequest, NextResponse } from 'next/server'
import { eq, and, ne, gte, inArray, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems } from '@/lib/db'
import { getExtensionUser } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

const UZUM_PUBLIC = 'https://api.uzum.uz'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Params ───────────────────────────────────────────────────────────────────
  const { searchParams } = req.nextUrl
  const marketplace = searchParams.get('marketplace')   // 'uzum' | 'yandex'
  const productId   = searchParams.get('productId')

  if (!marketplace || !productId) {
    return NextResponse.json({ error: 'marketplace va productId talab etiladi' }, { status: 400 })
  }

  const mpType = marketplace === 'yandex' ? 'yandex_market' as const : 'uzum' as const

  // ── Own product lookup ────────────────────────────────────────────────────────
  let ownProduct: {
    title: string
    sellingPrice: number
    costPrice: number | null
    stockQuantity: number
    margin: number | null
    drr: number | null
    stockDaysRemaining: number | null
    sales7d: number
    dashboardUrl: string
  } | null = null

  const shopRows = await db.select({ id: shops.id })
    .from(shops)
    .where(and(
      eq(shops.user_id, user.id),
      eq(shops.is_active, true),
      eq(shops.marketplace, mpType),
      ne(shops.shop_id_external, 'DEMO'),
    ))

  if (shopRows.length > 0) {
    const shopIds = shopRows.map(s => s.id)

    const [product] = await db.select({
      id: products.id,
      title: products.title,
      selling_price: products.selling_price,
      cost_price: products.cost_price,
      stock_quantity: products.stock_quantity,
    }).from(products)
      .where(and(
        inArray(products.shop_id, shopIds),
        eq(products.marketplace_product_id, productId),
      ))
      .limit(1)

    if (product) {
      const since7d  = new Date(); since7d.setDate(since7d.getDate() - 7)
      const since30d = new Date(); since30d.setDate(since30d.getDate() - 30)

      // Sales in last 7 days: order_items rows joined to non-cancelled orders.
      // One query — collapse the old two-step (fetch order ids, then count
      // order_items in those orders) into a single JOIN.
      const [salesRow] = await db.select({
        n: sql<number>`coalesce(count(${orderItems.id}), 0)`.as('n'),
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .where(and(
          eq(orderItems.product_id, product.id),
          inArray(orders.shop_id, shopIds),
          ne(orders.status, 'cancelled'),
          gte(orders.ordered_at, since7d),
        ))
      const sales7d = Number(salesRow?.n ?? 0)

      // DRR: shop-level fee / revenue ratio (last 30 days).
      //
      // `feeReported` is the reason this is two columns and not one. Yandex
      // leaves marketplace_fee NULL until its netting report arrives, so
      // sum(fee) over a Yandex-only shop is NULL — and coalescing that to 0
      // used to show the seller "DRR 0.0%", a number that reads as
      // "your marketplace charges you nothing". No fee reported yet is not a
      // fee of nothing; it is an answer we do not have, so send null and let
      // the extension say so.
      const [drrRow] = await db.select({
        totalRev: sql<number>`coalesce(sum(${orders.revenue}::numeric), 0)`,
        totalFee: sql<number>`sum(${orders.marketplace_fee}::numeric)`,
        feeReported: sql<number>`count(${orders.marketplace_fee})`,
      }).from(orders)
        .where(and(
          inArray(orders.shop_id, shopIds),
          ne(orders.status, 'cancelled'),
          gte(orders.ordered_at, since30d),
        ))
      const totalRev = Number(drrRow?.totalRev ?? 0)
      const drr = totalRev > 0 && Number(drrRow?.feeReported ?? 0) > 0
        ? Math.round((Number(drrRow!.totalFee) / totalRev) * 1000) / 10
        : null

      const sellingPrice = Number(product.selling_price ?? 0)
      // Same rule one level down: a product the seller has not costed has an
      // unknown margin, not a 100% one.
      const costPrice    = product.cost_price != null ? Number(product.cost_price) : null
      const margin = sellingPrice > 0 && costPrice != null
        ? Math.round(((sellingPrice - costPrice) / sellingPrice) * 1000) / 10
        : null

      const dailySales = sales7d / 7
      const stockDaysRemaining = dailySales > 0
        ? Math.round(product.stock_quantity / dailySales)
        : null

      ownProduct = {
        title:               product.title,
        sellingPrice,
        costPrice,
        stockQuantity:       product.stock_quantity,
        margin,
        drr,
        stockDaysRemaining,
        sales7d,
        dashboardUrl:        'https://daromadchi.uz/dashboard/products',
      }
    }
  }

  // ── Market data (Uzum public API) ─────────────────────────────────────────────
  let marketData = null

  if (marketplace === 'uzum') {
    try {
      // Uzum's PUBLIC catalogue API — no seller credentials involved — but it is
      // still a marketplace host, and routing it through the guard is what keeps
      // "every marketplace call is accounted for" true rather than nearly true.
      const res = await marketplaceFetch(`${UZUM_PUBLIC}/api/v1/product/${productId}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      })
      if (res.ok) {
        const raw = await res.json()
        const p = raw?.payload?.product ?? raw?.product ?? raw
        if (p) {
          marketData = {
            minPrice:     p.minSellPrice ?? p.minFullPrice ?? 0,
            maxPrice:     p.maxSellPrice ?? p.maxFullPrice ?? 0,
            avgRating:    p.rating       ?? null,
            reviewCount:  p.reviewsAmount ?? 0,
            ordersAmount: p.ordersAmount  ?? null,
          }
        }
      }
    } catch { /* market data is optional */ }
  }

  // Yandex public market data requires a separate API key — graceful degradation for now
  // Will be added when Yandex Content API integration is implemented

  return NextResponse.json({ ownProduct, marketData })
})
