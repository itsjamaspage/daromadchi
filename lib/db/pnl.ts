import { createClient } from '@/lib/supabase/server'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export interface MonthlyPnl {
  month: string
  revenue: number
  marketplace_fee: number
  delivery_cost: number
  net: number
  order_count: number
}

export async function getMonthlyPnl(months = 6): Promise<MonthlyPnl[]> {
  if (!supabaseConfigured) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const { data, error } = await supabase
    .from('orders')
    .select('ordered_at, revenue, marketplace_fee, delivery_cost')
    .neq('status', 'cancelled')
    .gte('ordered_at', since.toISOString())
    .order('ordered_at', { ascending: true })

  if (error || !data || data.length === 0) return []

  const grouped = new Map<string, { revenue: number; fee: number; delivery: number; count: number }>()

  for (const row of data) {
    const d = new Date(row.ordered_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const ex = grouped.get(key) ?? { revenue: 0, fee: 0, delivery: 0, count: 0 }
    grouped.set(key, {
      revenue:  ex.revenue  + Number(row.revenue          ?? 0),
      fee:      ex.fee      + Number(row.marketplace_fee  ?? 0),
      delivery: ex.delivery + Number(row.delivery_cost    ?? 0),
      count:    ex.count + 1,
    })
  }

  return Array.from(grouped.entries()).map(([key, v]) => {
    const d = new Date(key + '-01')
    return {
      month:           d.toLocaleDateString('uz-UZ', { month: 'short', year: '2-digit' }),
      revenue:         v.revenue,
      marketplace_fee: v.fee,
      delivery_cost:   v.delivery,
      net:             v.revenue - v.fee - v.delivery,
      order_count:     v.count,
    }
  })
}
