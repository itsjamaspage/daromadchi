import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { PayoutEntry } from '@/lib/types'

export type { PayoutEntry }

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

function mapRow(row: Record<string, unknown>): PayoutEntry {
  return {
    id:               String(row.id),
    period:           String(row.period),
    marketplace:      (row.marketplace as string) ?? undefined,
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

  const userId = await getCurrentUserId()
  if (!userId) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapRow)
}
