import { inArray, gte, and } from 'drizzle-orm'
import { db, orders, orderItems } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import type { MarketplaceType } from '@/lib/types'

export interface Variability {
  cv: number
  totalUnits: number
}

export async function getDemandVariability(
  months = 6,
  marketplace?: MarketplaceType,
): Promise<Map<string, Variability>> {
  const out = new Map<string, Variability>()

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return out

  const since = new Date()
  since.setMonth(since.getMonth() - (months - 1))
  since.setDate(1)

  const orderRows = await db.select({
    id: orders.id,
    ordered_at: orders.ordered_at,
  }).from(orders)
    .where(and(
      inArray(orders.shop_id, shopIds),
      inArray(orders.status, ['pending', 'confirmed', 'delivered']),
      gte(orders.ordered_at, since),
    ))

  if (orderRows.length === 0) return out

  const orderMonth = new Map<string, string>()
  for (const o of orderRows) {
    orderMonth.set(o.id, o.ordered_at.toISOString().slice(0, 7))
  }

  const orderIds = orderRows.map(o => o.id)
  const items = await db.select({
    product_id: orderItems.product_id,
    quantity: orderItems.quantity,
    order_id: orderItems.order_id,
  }).from(orderItems)
    .where(inArray(orderItems.order_id, orderIds))

  if (items.length === 0) return out

  const perProduct = new Map<string, Map<string, number>>()
  for (const it of items) {
    if (!it.product_id) continue
    const m = orderMonth.get(it.order_id)
    if (!m) continue
    let pm = perProduct.get(it.product_id)
    if (!pm) { pm = new Map(); perProduct.set(it.product_id, pm) }
    pm.set(m, (pm.get(m) ?? 0) + (it.quantity ?? 0))
  }

  const monthKeys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthKeys.push(d.toISOString().slice(0, 7))
  }

  for (const [pid, pm] of perProduct) {
    const series = monthKeys.map(k => pm.get(k) ?? 0)
    const total = series.reduce((s, v) => s + v, 0)
    const mean = total / series.length
    if (mean === 0) { out.set(pid, { cv: Infinity, totalUnits: 0 }); continue }
    const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length
    out.set(pid, { cv: Math.sqrt(variance) / mean, totalUnits: total })
  }

  return out
}
