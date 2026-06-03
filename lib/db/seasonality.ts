import { createClient } from '@/lib/supabase/server'
import type { MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export interface SeasonalityPoint {
  month: string
  revenue: number
  orders: number
  avgCheck: number
}

export interface ProductSeasonality {
  productId: string
  productTitle: string
  category: string
  data: SeasonalityPoint[]
  peakMonth: string
  lowMonth: string
  growthPct: number
}

const MONTHS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

async function getShopIds(marketplace?: MarketplaceType): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  let q = supabase.from('shops').select('id').eq('user_id', user.id)
  if (marketplace) q = q.eq('marketplace', marketplace)
  const { data } = await q
  return (data ?? []).map((s: { id: string }) => s.id)
}

/**
 * Real per-product monthly seasonality built from the last 12 months of
 * order_items × orders. Returns the top products by revenue. Empty array
 * when there is no synced data.
 */
export async function getSeasonality(maxProducts = 6, marketplace?: MarketplaceType): Promise<ProductSeasonality[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const supabase = await createClient()
  const since = new Date()
  since.setMonth(since.getMonth() - 11)
  since.setDate(1)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, ordered_at')
    .in('shop_id', shopIds)
    .neq('status', 'cancelled')
    .gte('ordered_at', since.toISOString())

  if (!orders || orders.length === 0) return []

  const orderMonth = new Map<string, string>() // order_id → 'YYYY-MM'
  for (const o of orders) {
    const d = new Date(o.ordered_at as string)
    orderMonth.set(o.id as string, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const orderIds = [...orderMonth.keys()]
  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, product_id, quantity, price_per_unit')
    .in('order_id', orderIds)

  if (!items || items.length === 0) return []

  // product_id → month → { revenue, orders }
  const agg = new Map<string, Map<string, { revenue: number; orders: number }>>()
  for (const it of items) {
    const pid = it.product_id as string | null
    if (!pid) continue
    const month = orderMonth.get(it.order_id as string)
    if (!month) continue
    const qty = Number(it.quantity ?? 0)
    const revenue = qty * Number(it.price_per_unit ?? 0)
    if (!agg.has(pid)) agg.set(pid, new Map())
    const m = agg.get(pid)!
    const ex = m.get(month) ?? { revenue: 0, orders: 0 }
    m.set(month, { revenue: ex.revenue + revenue, orders: ex.orders + qty })
  }

  if (agg.size === 0) return []

  // product titles + categories
  const { data: products } = await supabase
    .from('products')
    .select('id, title, category')
    .in('id', [...agg.keys()])

  const meta = new Map<string, { title: string; category: string }>()
  for (const p of products ?? []) {
    meta.set(p.id as string, { title: (p.title as string) ?? '—', category: (p.category as string) ?? '—' })
  }

  // chronological month keys for the last 12 months
  const monthKeys: string[] = []
  const cur = new Date(since)
  for (let i = 0; i < 12; i++) {
    monthKeys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }

  const result: ProductSeasonality[] = []
  for (const [pid, byMonth] of agg) {
    const m = meta.get(pid)
    if (!m) continue

    const data: SeasonalityPoint[] = monthKeys
      .filter(k => byMonth.has(k))
      .map(k => {
        const v = byMonth.get(k)!
        const monthIdx = Number(k.slice(5)) - 1
        return {
          month: MONTHS_UZ[monthIdx],
          revenue: Math.round(v.revenue),
          orders: v.orders,
          avgCheck: v.orders > 0 ? Math.round(v.revenue / v.orders) : 0,
        }
      })

    if (data.length === 0) continue

    let peak = data[0], low = data[0]
    for (const pt of data) {
      if (pt.revenue > peak.revenue) peak = pt
      if (pt.revenue < low.revenue) low = pt
    }
    const first = data[0].revenue
    const last = data[data.length - 1].revenue
    const growthPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0

    result.push({
      productId: pid,
      productTitle: m.title,
      category: m.category,
      data,
      peakMonth: peak.month,
      lowMonth: low.month,
      growthPct,
    })
  }

  const totalRevenue = (p: ProductSeasonality) => p.data.reduce((s, d) => s + d.revenue, 0)
  return result.sort((a, b) => totalRevenue(b) - totalRevenue(a)).slice(0, maxProducts)
}
