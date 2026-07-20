import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getExtensionUser, getShopIds, getUserPlan } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shopIdParam = req.nextUrl.searchParams.get('shopId')
  const shopIds = await getShopIds(user.id, shopIdParam)

  if (shopIds.length === 0) {
    return NextResponse.json({
      todayRevenue: 0, todayProfit: 0, todayOrders: 0,
      todayCommission: 0, lowStock: 0, lastSynced: null,
      todayCancelled: 0, todayReturns: 0, marginPct: 0,
      revenueChange: null, ordersChange: null, returnRate: 0,
    })
  }

  const plan = await getUserPlan(user.id)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const since = new Date()
  if (plan === 'free') {
    since.setDate(since.getDate() - 7)
    since.setUTCHours(0, 0, 0, 0)
  } else {
    since.setUTCHours(0, 0, 0, 0)
  }

  const [todayOrdersRes, yesterdayOrdersRes, cancelledRes, returnedRes, inProcessRes, stockRes, shopsRes] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost, status')
      .in('shop_id', shopIds)
      .gte('ordered_at', since.toISOString()),
    supabaseAdmin
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost, status')
      .in('shop_id', shopIds)
      .gte('ordered_at', yesterday.toISOString())
      .lt('ordered_at', today.toISOString()),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('shop_id', shopIds)
      .eq('status', 'cancelled'),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('shop_id', shopIds)
      .eq('status', 'returned'),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('shop_id', shopIds)
      .in('status', ['pending', 'confirmed']),
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

  type OrderRow = { revenue: string | null; marketplace_fee: string | null; delivery_cost: string | null; status: string }
  const allTodayOrders  = (todayOrdersRes.data ?? []) as OrderRow[]
  const activeOrders    = allTodayOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const todayRevenue    = activeOrders.reduce((s, o) => s + Number(o.revenue        ?? 0), 0)
  const todayCommission = activeOrders.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const todayDelivery   = activeOrders.reduce((s, o) => s + Number(o.delivery_cost  ?? 0), 0)
  const todayProfit     = todayRevenue - todayCommission - todayDelivery
  const todayOrders     = activeOrders.length
  const todayCancelled  = allTodayOrders.filter(o => o.status === 'cancelled').length
  const todayReturned   = allTodayOrders.filter(o => o.status === 'returned').length
  const marginPct       = todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 100) : 0

  const yesterdayOrders = (yesterdayOrdersRes.data ?? []) as OrderRow[]
  const yesterdayActive = yesterdayOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const yesterdayRevenue = yesterdayActive.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
  const yesterdayOrderCount = yesterdayActive.length

  const revenueChange = yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : null
  const ordersChange  = yesterdayOrderCount > 0 ? Math.round(((todayOrders - yesterdayOrderCount) / yesterdayOrderCount) * 100) : null

  const totalCancelled = cancelledRes.count ?? 0
  const totalReturned  = returnedRes.count ?? 0
  const totalInProcess = inProcessRes.count ?? 0
  const totalOrders    = allTodayOrders.length
  const returnRate     = totalOrders > 0 ? Math.round((totalReturned / totalOrders) * 100) : 0

  const lowStock   = stockRes.data?.length ?? 0
  const lastSynced = shopsRes.data?.[0]?.last_synced_at ?? null

  return NextResponse.json({
    todayRevenue, todayProfit, todayOrders, todayCommission, lowStock, lastSynced,
    todayCancelled: todayCancelled + totalCancelled,
    todayReturns: todayReturned + totalReturned,
    inProcess: totalInProcess,
    marginPct, revenueChange, ordersChange, returnRate,
    plan,
    ...(plan === 'free' ? { historyDays: 7 } : {}),
  })
})
