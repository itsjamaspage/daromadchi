import { createClient } from '@/lib/supabase/server'
import { dailyRevenue as mockRevenue } from '@/lib/mock-data'
import type { DailyRevenue } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// Extend mock data for longer ranges by repeating the 7-day pattern
function buildMockRevenue(days: number): DailyRevenue[] {
  const result: DailyRevenue[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })
    const base = mockRevenue[i % mockRevenue.length]
    result.push({ date: label, revenue: base.revenue, order_count: 0 })
  }
  return result
}

export async function getDailyRevenue(days = 7): Promise<DailyRevenue[]> {
  if (!supabaseConfigured) {
    return buildMockRevenue(days)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)

  const { data, error } = await supabase
    .from('daily_revenue')
    .select('date, revenue, order_count')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true })

  if (error || !data) return []

  return data.map(r => ({
    date: new Date(r.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
    revenue: Number(r.revenue),
    order_count: Number(r.order_count),
  }))
}
