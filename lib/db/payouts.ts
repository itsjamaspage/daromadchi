import { createClient } from '@/lib/supabase/server'
import type { PayoutEntry } from '@/lib/types'

export type { PayoutEntry }

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

function mapRow(row: Record<string, unknown>): PayoutEntry {
  return {
    id:               String(row.id),
    period:           String(row.period),
    grossRevenue:     Number(row.gross_revenue),
    commission:       Number(row.commission),
    delivery:         Number(row.delivery),
    returns:          Number(row.returns),
    adSpend:          Number(row.ad_spend),
    acquiring:        Number(row.acquiring),
    tax:              Number(row.tax),
    otherDeductions:  Number(row.other_deductions ?? 0),
    netPayout:        Number(row.net_payout),
    ordersCount:      Number(row.orders_count),
    status:           row.status as PayoutEntry['status'],
    payoutDate:       (row.payout_date as string) ?? null,
  }
}

export async function getPayoutEntries(): Promise<PayoutEntry[]> {
  if (!supabaseConfigured) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapRow)
}
