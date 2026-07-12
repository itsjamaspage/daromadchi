import { inArray, ne, gte, and } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getShopIds as resolveShopIds } from '@/lib/db/shop-context'
import type { MarketplaceType } from '@/lib/types'

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
  return (await resolveShopIds(marketplace)) ?? []
}

export async function getSeasonality(maxProducts = 6, marketplace?: MarketplaceType): Promise<ProductSeasonality[]> {
  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const since = new Date()
  since.setMonth(since.getMonth() - 11)
  since.setDate(1)

  const orderRows = await db.select({
    id: orders.id,
    ordered_at: orders.ordered_at,
  }).from(orders)
    .where(and(
      inArray(orders.shop_id, shopIds),
      ne(orders.status, 'cancelled'),
      gte(orders.ordered_at, since),
    ))

  if (orderRows.length === 0) return []

  const orderMonth = new Map<string, string>()
  for (const o of orderRows) {
    const d = o.ordered_at
    orderMonth.set(o.id, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const orderIds = [...orderMonth.keys()]
  const items = await db.select({
    order_id: orderItems.order_id,
    product_id: orderItems.product_id,
    quantity: orderItems.quantity,
    price_per_unit: orderItems.price_per_unit,
  }).from(orderItems)
    .where(inArray(orderItems.order_id, orderIds))

  if (items.length === 0) return []

  const agg = new Map<string, Map<string, { revenue: number; orders: number }>>()
  for (const it of items) {
    const pid = it.product_id
    if (!pid) continue
    const month = orderMonth.get(it.order_id)
    if (!month) continue
    const qty = it.quantity ?? 0
    const revenue = qty * Number(it.price_per_unit ?? 0)
    if (!agg.has(pid)) agg.set(pid, new Map())
    const m = agg.get(pid)!
    const ex = m.get(month) ?? { revenue: 0, orders: 0 }
    m.set(month, { revenue: ex.revenue + revenue, orders: ex.orders + qty })
  }

  if (agg.size === 0) return []

  const productIds = [...agg.keys()]
  const prodRows = await db.select({
    id: products.id,
    title: products.title,
    category: products.category,
  }).from(products)
    .where(inArray(products.id, productIds))

  const meta = new Map<string, { title: string; category: string }>()
  for (const p of prodRows) {
    meta.set(p.id, { title: p.title ?? '—', category: p.category ?? '—' })
  }

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
