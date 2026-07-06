/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Parity verification: compare old JS-aggregation results against new RPC results.
 *
 * Usage:
 *   npx tsx scripts/verify-rpc-parity.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 * Tests 3 RPCs × 8+ cases each = 24+ comparisons. Zero mismatches required.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !key) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL'); process.exit(1) }
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label: string, a: unknown, b: unknown) {
  const sa = JSON.stringify(a)
  const sb = JSON.stringify(b)
  if (sa === sb) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.error(`  ❌ ${label}`)
    console.error(`     OLD: ${sa}`)
    console.error(`     NEW: ${sb}`)
  }
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

// The user's ID for testing
const USER_ID = '4d1182a9-4785-4a83-a492-433ff081b1ae'

async function getShopIds(marketplace?: string): Promise<string[]> {
  let q = supabase.from('shops').select('id').eq('user_id', USER_ID)
    .eq('is_active', true).neq('shop_id_external', 'DEMO')
  if (marketplace) q = q.eq('marketplace', marketplace)
  const { data } = await q
  return (data ?? []).map(s => s.id)
}

// ── OLD implementations (copy-pasted from the pre-RPC code) ─────────────────

async function oldGetKpis(shopIds: string[], days: number, from: string, to: string) {
  if (shopIds.length === 0) return { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

  let sinceIso: string | null = null
  let untilIso: string | null = null
  let prevSinceIso: string | null = null
  let prevUntilIso: string | null = null

  if (from && to) {
    sinceIso = new Date(from).toISOString()
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
    untilIso = toDate.toISOString()
    const spanMs = toDate.getTime() - new Date(from).getTime()
    const prevTo = new Date(new Date(from).getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - spanMs)
    prevSinceIso = prevFrom.toISOString()
    prevUntilIso = prevTo.toISOString()
  } else if (days > 0) {
    const now = new Date()
    const since = new Date(now); since.setDate(since.getDate() - days + 1)
    const prevSince = new Date(since); prevSince.setDate(prevSince.getDate() - days)
    sinceIso = since.toISOString()
    prevSinceIso = prevSince.toISOString()
    prevUntilIso = since.toISOString()
  }

  let ordersQuery = supabase.from('orders').select('revenue, marketplace_fee, delivery_cost')
    .in('shop_id', shopIds).neq('status', 'cancelled')
  if (sinceIso) ordersQuery = ordersQuery.gte('ordered_at', sinceIso)
  if (untilIso) ordersQuery = ordersQuery.lte('ordered_at', untilIso)

  let prevOrdersQuery = supabase.from('orders').select('revenue, marketplace_fee, delivery_cost')
    .in('shop_id', shopIds).neq('status', 'cancelled')
  if (prevSinceIso) prevOrdersQuery = prevOrdersQuery.gte('ordered_at', prevSinceIso)
  if (prevUntilIso) prevOrdersQuery = prevOrdersQuery.lt('ordered_at', prevUntilIso)

  const [ordersRes, prevOrdersRes, stockRes] = await Promise.all([
    ordersQuery,
    prevSinceIso ? prevOrdersQuery : Promise.resolve({ data: [] as { revenue: number; marketplace_fee: number; delivery_cost: number }[] }),
    supabase.from('products').select('stock_quantity').in('shop_id', shopIds),
  ])

  const rows = ordersRes.data ?? []
  const total_revenue = rows.reduce((s: number, o: any) => s + Number(o.revenue ?? 0), 0)
  const total_profit = rows.reduce((s: number, o: any) => s + Number(o.revenue ?? 0) - Number(o.marketplace_fee ?? 0) - Number(o.delivery_cost ?? 0), 0)
  const total_orders = rows.length
  const prevRows = prevOrdersRes.data ?? []
  const prev_revenue = prevRows.reduce((s: number, o: any) => s + Number(o.revenue ?? 0), 0)
  const prev_profit = prevRows.reduce((s: number, o: any) => s + Number(o.revenue ?? 0) - Number(o.marketplace_fee ?? 0) - Number(o.delivery_cost ?? 0), 0)
  const prev_orders = prevRows.length
  const total_stock = (stockRes.data ?? []).reduce((s: number, p: any) => s + (p.stock_quantity ?? 0), 0)

  return {
    total_revenue, total_profit, total_orders, total_stock,
    change_revenue: prevSinceIso ? pct(total_revenue, prev_revenue) : null,
    change_profit: prevSinceIso ? pct(total_profit, prev_profit) : null,
    change_orders: prevSinceIso ? pct(total_orders, prev_orders) : null,
  }
}

async function newGetKpis(shopIds: string[], days: number, from: string, to: string) {
  if (shopIds.length === 0) return { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

  let sinceIso: string | null = null
  let untilIso: string | null = null
  let prevSinceIso: string | null = null
  let prevUntilIso: string | null = null

  if (from && to) {
    sinceIso = new Date(from).toISOString()
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
    untilIso = toDate.toISOString()
    const spanMs = toDate.getTime() - new Date(from).getTime()
    const prevTo = new Date(new Date(from).getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - spanMs)
    prevSinceIso = prevFrom.toISOString()
    prevUntilIso = prevTo.toISOString()
  } else if (days > 0) {
    const now = new Date()
    const since = new Date(now); since.setDate(since.getDate() - days + 1)
    const prevSince = new Date(since); prevSince.setDate(prevSince.getDate() - days)
    sinceIso = since.toISOString()
    prevSinceIso = prevSince.toISOString()
    prevUntilIso = since.toISOString()
  }

  const { data, error } = await supabase.rpc('get_dashboard_kpis', {
    p_shop_ids: shopIds,
    p_since: sinceIso,
    p_until: untilIso,
    p_prev_since: prevSinceIso,
    p_prev_until: prevUntilIso,
  })

  if (error || !data || data.length === 0) return { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }

  const row = data[0]
  const total_revenue = Number(row.total_revenue ?? 0)
  const total_profit = Number(row.total_profit ?? 0)
  const total_orders = Number(row.total_orders ?? 0)
  const total_stock = Number(row.total_stock ?? 0)
  const prev_revenue = Number(row.prev_revenue ?? 0)
  const prev_profit = Number(row.prev_profit ?? 0)
  const prev_orders = Number(row.prev_orders ?? 0)

  return {
    total_revenue, total_profit, total_orders, total_stock,
    change_revenue: prevSinceIso ? pct(total_revenue, prev_revenue) : null,
    change_profit: prevSinceIso ? pct(total_profit, prev_profit) : null,
    change_orders: prevSinceIso ? pct(total_orders, prev_orders) : null,
  }
}

async function oldGetDailyRevenue(shopIds: string[], days: number, from: string, to: string) {
  if (shopIds.length === 0) return []

  let sinceIso: string
  let untilIso: string | undefined

  if (from) {
    sinceIso = new Date(from).toISOString()
    untilIso = to ? new Date(to + 'T23:59:59').toISOString() : undefined
  } else {
    const since = new Date()
    since.setDate(since.getDate() - days + 1)
    sinceIso = since.toISOString()
  }

  let q = supabase.from('orders').select('ordered_at, revenue')
    .in('shop_id', shopIds).neq('status', 'cancelled')
    .gte('ordered_at', sinceIso).order('ordered_at', { ascending: true })
  if (untilIso) q = q.lte('ordered_at', untilIso)

  const { data, error } = await q
  if (error || !data) return []

  const grouped = new Map<string, { revenue: number; count: number }>()
  for (const row of data as any[]) {
    const date = row.ordered_at.slice(0, 10)
    const existing = grouped.get(date) ?? { revenue: 0, count: 0 }
    grouped.set(date, { revenue: existing.revenue + Number(row.revenue ?? 0), count: existing.count + 1 })
  }

  return Array.from(grouped.entries()).map(([date, v]) => ({
    date,
    revenue: v.revenue,
    order_count: v.count,
  }))
}

async function newGetDailyRevenue(shopIds: string[], days: number, from: string, to: string) {
  if (shopIds.length === 0) return []

  let sinceIso: string
  let untilIso: string | null = null

  if (from) {
    sinceIso = new Date(from).toISOString()
    untilIso = to ? new Date(to + 'T23:59:59').toISOString() : null
  } else {
    const since = new Date()
    since.setDate(since.getDate() - days + 1)
    sinceIso = since.toISOString()
  }

  const { data, error } = await supabase.rpc('get_daily_revenue', {
    p_shop_ids: shopIds,
    p_since: sinceIso,
    p_until: untilIso,
  })

  if (error || !data) return []

  return (data as any[]).map(row => ({
    date: row.day,
    revenue: Number(row.revenue ?? 0),
    order_count: Number(row.order_count ?? 0),
  }))
}

async function oldGetCategoryRevenue(shopIds: string[], days: number, from: string, to: string) {
  if (shopIds.length === 0) return []

  let sinceIso: string | null = null
  let untilIso: string | null = null
  if (from && to) {
    sinceIso = new Date(from).toISOString()
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
    untilIso = toDate.toISOString()
  } else if (days > 0) {
    const d = new Date(); d.setDate(d.getDate() - days + 1)
    sinceIso = d.toISOString()
  }

  let orderQuery = supabase.from('orders').select('id').in('shop_id', shopIds)
  if (sinceIso) orderQuery = orderQuery.gte('ordered_at', sinceIso)
  if (untilIso) orderQuery = orderQuery.lte('ordered_at', untilIso)
  const { data: orderRows, error: orderErr } = await orderQuery
  if (orderErr || !orderRows?.length) return []

  const orderIds = (orderRows as { id: string }[]).map(r => r.id)

  const { data: items, error: itemErr } = await supabase
    .from('order_items')
    .select('price_per_unit, quantity, cost_per_unit, products(category)')
    .in('order_id', orderIds)
  if (itemErr || !items?.length) return []

  const catMap = new Map<string, { revenue: number; cost: number }>()
  for (const item of items as any[]) {
    const cat: string = item.products?.category ?? 'Boshqa'
    const rev = Number(item.price_per_unit) * Number(item.quantity)
    const cst = Number(item.cost_per_unit) * Number(item.quantity)
    const cur = catMap.get(cat) ?? { revenue: 0, cost: 0 }
    catMap.set(cat, { revenue: cur.revenue + rev, cost: cur.cost + cst })
  }

  const entries = [...catMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
  const total = entries.reduce((s, [, v]) => s + v.revenue, 0)
  return entries.map(([name, { revenue, cost }]) => ({
    name,
    revenue: Math.round(revenue),
    profit: Math.round(revenue - cost),
    percent: total > 0 ? (revenue / total) * 100 : 0,
  }))
}

async function newGetCategoryRevenue(shopIds: string[], days: number, from: string, to: string) {
  if (shopIds.length === 0) return []

  let sinceIso: string | null = null
  let untilIso: string | null = null
  if (from && to) {
    sinceIso = new Date(from).toISOString()
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999)
    untilIso = toDate.toISOString()
  } else if (days > 0) {
    const d = new Date(); d.setDate(d.getDate() - days + 1)
    sinceIso = d.toISOString()
  }

  const { data, error } = await supabase.rpc('get_category_revenue', {
    p_shop_ids: shopIds,
    p_since: sinceIso,
    p_until: untilIso,
  })

  if (error || !data || data.length === 0) return []

  return (data as any[]).map(r => ({
    name: r.name,
    revenue: Number(r.revenue ?? 0),
    profit: Number(r.profit ?? 0),
    percent: Number(r.percent ?? 0),
  }))
}

// ── Test runner ──────────────────────────────────────────────────────────────

interface TestCase {
  label: string
  days: number
  from: string
  to: string
  marketplace?: string
}

async function run() {
  console.log('🔍 Dashboard RPC parity verification')
  console.log('=====================================\n')

  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const cases: TestCase[] = [
    // days mode
    { label: 'all marketplaces, days=30', days: 30, from: '', to: '' },
    { label: 'uzum, days=30', days: 30, from: '', to: '', marketplace: 'uzum' },
    { label: 'yandex_market, days=30', days: 30, from: '', to: '', marketplace: 'yandex_market' },
    { label: 'wildberries, days=30', days: 30, from: '', to: '', marketplace: 'wildberries' },
    // from/to mode
    { label: 'all marketplaces, from/to range', days: 0, from: thirtyDaysAgo, to: today },
    { label: 'uzum, from/to range', days: 0, from: thirtyDaysAgo, to: today, marketplace: 'uzum' },
    { label: 'yandex_market, from/to range', days: 0, from: thirtyDaysAgo, to: today, marketplace: 'yandex_market' },
    { label: 'wildberries, from/to range', days: 0, from: thirtyDaysAgo, to: today, marketplace: 'wildberries' },
  ]

  // ── getKpis ──
  console.log('📊 getKpis')
  for (const c of cases) {
    const shopIds = await getShopIds(c.marketplace)
    const [oldResult, newResult] = await Promise.all([
      oldGetKpis(shopIds, c.days, c.from, c.to),
      newGetKpis(shopIds, c.days, c.from, c.to),
    ])
    assert(`KPIs: ${c.label}`, oldResult, newResult)
  }

  // ── getDailyRevenue ──
  console.log('\n📈 getDailyRevenue')
  for (const c of cases) {
    const shopIds = await getShopIds(c.marketplace)
    const [oldResult, newResult] = await Promise.all([
      oldGetDailyRevenue(shopIds, c.days, c.from, c.to),
      newGetDailyRevenue(shopIds, c.days, c.from, c.to),
    ])
    assert(`Revenue: ${c.label}`, oldResult, newResult)
  }

  // ── getCategoryRevenue ──
  console.log('\n📊 getCategoryRevenue')
  for (const c of cases) {
    const shopIds = await getShopIds(c.marketplace)
    const [oldResult, newResult] = await Promise.all([
      oldGetCategoryRevenue(shopIds, c.days, c.from, c.to),
      newGetCategoryRevenue(shopIds, c.days, c.from, c.to),
    ])
    assert(`Category: ${c.label}`, oldResult, newResult)
  }

  // ── Summary ──
  console.log('\n=====================================')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  if (failed > 0) {
    console.error('\n🚫 PARITY VERIFICATION FAILED — do not push.')
    process.exit(1)
  } else {
    console.log('\n🎉 All checks passed — RPC results match JS aggregation exactly.')
  }
}

run().catch(err => { console.error(err); process.exit(1) })
