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

const MOCK: MonthlyPnl[] = [
  { month: 'Noy', revenue: 68_000_000, marketplace_fee: 5_100_000, delivery_cost: 2_040_000, net: 60_860_000, order_count: 312 },
  { month: 'Dek', revenue: 84_000_000, marketplace_fee: 6_300_000, delivery_cost: 2_520_000, net: 75_180_000, order_count: 398 },
  { month: 'Yan', revenue: 72_000_000, marketplace_fee: 5_400_000, delivery_cost: 2_160_000, net: 64_440_000, order_count: 341 },
  { month: 'Fev', revenue: 91_000_000, marketplace_fee: 6_825_000, delivery_cost: 2_730_000, net: 81_445_000, order_count: 421 },
  { month: 'Mar', revenue: 108_000_000, marketplace_fee: 8_100_000, delivery_cost: 3_240_000, net: 96_660_000, order_count: 503 },
  { month: 'Apr', revenue: 124_500_000, marketplace_fee: 9_337_500, delivery_cost: 3_735_000, net: 111_427_500, order_count: 578 },
]

export async function getMonthlyPnl(months = 6): Promise<MonthlyPnl[]> {
  if (!supabaseConfigured) return MOCK

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
