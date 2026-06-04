import { createClient } from '@/lib/supabase/server'
import { getShopIds } from '@/lib/db/shop-context'
import type { MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export interface Variability {
  cv: number          // coefficient of variation of monthly units
  totalUnits: number
}

/**
 * Coefficient of variation (stddev ÷ mean) of monthly unit sales per product
 * over the last `months` months — the real basis for XYZ demand-stability
 * analysis. Built from order_items × orders.
 *
 * Returns an empty/partial map when order_items aren't populated; callers should
 * treat a missing entry (or totalUnits 0) as "Z" (no establishable demand),
 * which is the honest result when we don't have item-level history.
 */
export async function getDemandVariability(
  months = 6,
  marketplace?: MarketplaceType,
): Promise<Map<string, Variability>> {
  const out = new Map<string, Variability>()
  if (!supabaseConfigured) return out

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return out

  const supabase = await createClient()
  const since = new Date()
  since.setMonth(since.getMonth() - (months - 1))
  since.setDate(1)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, ordered_at')
    .in('shop_id', shopIds)
    .in('status', ['pending', 'confirmed', 'delivered'])
    .gte('ordered_at', since.toISOString())
  if (!orders || orders.length === 0) return out

  const orderMonth = new Map<string, string>()
  for (const o of orders) orderMonth.set(o.id as string, String(o.ordered_at).slice(0, 7))
  const orderIds = orders.map(o => o.id as string)

  const items: { product_id: string | null; quantity: number; order_id: string }[] = []
  for (let i = 0; i < orderIds.length; i += 300) {
    const { data } = await supabase
      .from('order_items')
      .select('product_id, quantity, order_id')
      .in('order_id', orderIds.slice(i, i + 300))
    if (data) items.push(...(data as typeof items))
  }
  if (items.length === 0) return out

  // product → month → units
  const perProduct = new Map<string, Map<string, number>>()
  for (const it of items) {
    if (!it.product_id) continue
    const m = orderMonth.get(it.order_id)
    if (!m) continue
    let pm = perProduct.get(it.product_id)
    if (!pm) { pm = new Map(); perProduct.set(it.product_id, pm) }
    pm.set(m, (pm.get(m) ?? 0) + (it.quantity ?? 0))
  }

  // Fixed month window (missing months count as 0 demand)
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
