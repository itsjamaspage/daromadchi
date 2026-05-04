import { createClient } from '@/lib/supabase/server'
import { dailyRevenue as mockRevenue } from '@/lib/mock-data'
import type { DailyRevenue } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

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
  if (!supabaseConfigured) return buildMockRevenue(days)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)

  // RLS scopes this to the user's shops automatically
  const { data, error } = await supabase
    .from('orders')
    .select('ordered_at, revenue')
    .neq('status', 'cancelled')
    .gte('ordered_at', since.toISOString())
    .order('ordered_at', { ascending: true })

  if (error || !data) return []

  // Group by date in JS
  const grouped = new Map<string, { revenue: number; count: number }>()
  for (const row of data) {
    const date = row.ordered_at.slice(0, 10)
    const existing = grouped.get(date) ?? { revenue: 0, count: 0 }
    grouped.set(date, { revenue: existing.revenue + Number(row.revenue ?? 0), count: existing.count + 1 })
  }

  return Array.from(grouped.entries()).map(([date, v]) => ({
    date: new Date(date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
    revenue: v.revenue,
    order_count: v.count,
  }))
}
