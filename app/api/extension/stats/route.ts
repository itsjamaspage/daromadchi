import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser, getShopIds } from '@/lib/api/auth'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shopIdParam = req.nextUrl.searchParams.get('shopId')
  const shopIds = await getShopIds(user.id, shopIdParam)

  if (shopIds.length === 0) {
    return NextResponse.json({
      todayRevenue: 0, todayProfit: 0, todayOrders: 0,
      todayCommission: 0, lowStock: 0, lastSynced: null,
    })
  }

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const [ordersRes, stockRes, shopsRes] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('ordered_at', todayStart.toISOString()),
    supabaseAdmin
      .from('products')
      .select('stock_quantity', { count: 'exact', head: false })
      .in('shop_id', shopIds)
      .lte('stock_quantity', 5)
      .gt('stock_quantity', 0),
    supabaseAdmin
      .from('shops')
      .select('last_synced_at')
      .in('id', shopIds)
      .order('last_synced_at', { ascending: false })
      .limit(1),
  ])

  type OrderRow = { revenue: string | null; marketplace_fee: string | null; delivery_cost: string | null }
  const orders          = (ordersRes.data ?? []) as OrderRow[]
  const todayRevenue    = orders.reduce((s, o) => s + Number(o.revenue        ?? 0), 0)
  const todayCommission = orders.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const todayDelivery   = orders.reduce((s, o) => s + Number(o.delivery_cost  ?? 0), 0)
  const todayProfit     = todayRevenue - todayCommission - todayDelivery
  const todayOrders     = orders.length
  const lowStock        = stockRes.data?.length ?? 0
  const lastSynced      = shopsRes.data?.[0]?.last_synced_at ?? null

  return NextResponse.json({ todayRevenue, todayProfit, todayOrders, todayCommission, lowStock, lastSynced })
}
