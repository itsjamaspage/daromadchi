import { createClient } from '@/lib/supabase/server'
import { kpiData } from '@/lib/mock-data'
import type { Kpis } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getKpis(): Promise<Kpis> {
  if (!supabaseConfigured) {
    return {
      total_revenue: kpiData.revenue.value,
      total_profit: kpiData.profit.value,
      total_orders: kpiData.orders.value,
      total_stock: kpiData.stock.value,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_kpis')

  if (error || !data?.[0]) {
    return {
      total_revenue: 0,
      total_profit: 0,
      total_orders: 0,
      total_stock: 0,
    }
  }

  const row = data[0]
  return {
    total_revenue: Number(row.total_revenue),
    total_profit: Number(row.total_profit),
    total_orders: Number(row.total_orders),
    total_stock: Number(row.total_stock),
  }
}
