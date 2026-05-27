import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser, getShopIds } from '@/lib/api/auth'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const shopIdParam = searchParams.get('shopId')
  const page = Math.max(0, Number(searchParams.get('page') ?? 0))
  const size = Math.min(200, Math.max(1, Number(searchParams.get('size') ?? 50)))

  const shopIds = await getShopIds(user.id, shopIdParam)
  if (shopIds.length === 0) return NextResponse.json({ products: [], total: 0 })

  const { data: rows, count } = await supabaseAdmin
    .from('products')
    .select('id, title, sku, selling_price, cost_price, stock_quantity, category, marketplace_product_id', { count: 'exact' })
    .in('shop_id', shopIds)
    .order('stock_quantity', { ascending: true })
    .range(page * size, (page + 1) * size - 1)

  type ProductRow = { id: string; title: string; sku: string | null; selling_price: string | null; cost_price: string | null; stock_quantity: number; category: string | null; marketplace_product_id: string | null }
  const products = ((rows ?? []) as ProductRow[]).map(p => ({
    id:           p.id,
    name:         p.title,
    sku:          p.sku,
    stock:        p.stock_quantity,
    sellingPrice: Number(p.selling_price ?? 0),
    costPrice:    Number(p.cost_price    ?? 0),
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

  return NextResponse.json({ products, total: count ?? products.length })
}
