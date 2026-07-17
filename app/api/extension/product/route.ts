import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getExtensionUser } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

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

  const mpType = marketplace === 'yandex' ? 'yandex_market' : 'uzum'

  // ── Own product lookup ────────────────────────────────────────────────────────
  let ownProduct = null

  const { data: shops } = await supabaseAdmin
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .eq('marketplace', mpType)
    .neq('shop_id_external', 'DEMO')

  if (shops && shops.length > 0) {
    const shopIds = shops.map((s: { id: string }) => s.id)

    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, title, selling_price, cost_price, stock_quantity')
      .in('shop_id', shopIds)
      .eq('marketplace_product_id', productId)
      .maybeSingle()

    if (product) {
      const since7d  = new Date(); since7d.setDate(since7d.getDate() - 7)
      const since30d = new Date(); since30d.setDate(since30d.getDate() - 30)

      // Sales in last 7 days via order_items
      const { data: orderIds7d } = await supabaseAdmin
        .from('orders')
        .select('id')
        .in('shop_id', shopIds)
        .neq('status', 'cancelled')
        .gte('ordered_at', since7d.toISOString())

      let sales7d = 0
      if (orderIds7d && orderIds7d.length > 0) {
        const { count } = await supabaseAdmin
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .in('order_id', orderIds7d.map((o: { id: string }) => o.id))
        sales7d = count ?? 0
      }

      // DRR: shop-level fee / revenue ratio (last 30 days)
      const { data: orderStats } = await supabaseAdmin
        .from('orders')
        .select('revenue, marketplace_fee')
        .in('shop_id', shopIds)
        .neq('status', 'cancelled')
        .gte('ordered_at', since30d.toISOString())

      const totalRev = (orderStats ?? []).reduce((s: number, o: { revenue: string | null }) => s + Number(o.revenue ?? 0), 0)
      const totalFee = (orderStats ?? []).reduce((s: number, o: { marketplace_fee: string | null }) => s + Number(o.marketplace_fee ?? 0), 0)
      const drr = totalRev > 0 ? Math.round((totalFee / totalRev) * 1000) / 10 : null

      const sellingPrice = Number(product.selling_price ?? 0)
      const costPrice    = Number(product.cost_price    ?? 0)
      const margin = sellingPrice > 0
        ? Math.round(((sellingPrice - costPrice) / sellingPrice) * 1000) / 10
        : null

      const dailySales = sales7d / 7
      const stockDaysRemaining = dailySales > 0
        ? Math.round(product.stock_quantity / dailySales)
        : null

      ownProduct = {
        title:               product.title,
        sellingPrice,
        costPrice:           product.cost_price ? costPrice : null,
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
      const res = await fetch(`${UZUM_PUBLIC}/api/v1/product/${productId}`, {
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
