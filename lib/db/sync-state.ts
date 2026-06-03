import { createClient } from '@/lib/supabase/server'
import type { SyncDay } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

async function getFirstShopId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  return data?.id ?? null
}

export async function getSyncDays(days = 30): Promise<SyncDay[]> {
  if (!supabaseConfigured) return []

  const shopId = await getFirstShopId()
  if (!shopId) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sync_days')
    .select('*')
    .eq('shop_id', shopId)
    .gte('sync_date', since.toISOString().slice(0, 10))
    .order('sync_date', { ascending: true })

  if (error || !data) return []

  return data.map(row => ({
    date:          row.sync_date as string,
    status:        row.status as SyncDay['status'],
    productsCount: row.products_count !== null ? Number(row.products_count) : undefined,
    revenue:       row.revenue !== null ? Number(row.revenue) : undefined,
    adSpend:       row.ad_spend !== null ? Number(row.ad_spend) : undefined,
    errorMessage:  (row.error_message as string) ?? undefined,
  }))
}

export async function resyncDays(dates: string[]): Promise<void> {
  if (!supabaseConfigured || dates.length === 0) return

  const shopId = await getFirstShopId()
  if (!shopId) return

  const supabase = await createClient()
  // Mark selected days as pending so the sync worker picks them up
  await supabase
    .from('sync_days')
    .upsert(
      dates.map(date => ({
        shop_id:   shopId,
        sync_date: date,
        status:    'pending' as const,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'shop_id,sync_date' }
    )
}
