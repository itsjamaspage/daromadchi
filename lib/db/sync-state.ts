import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { SyncDay, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

async function getShopId(marketplace: MarketplaceType): Promise<string | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', userId)
    .eq('marketplace', marketplace)
    .neq('shop_id_external', 'DEMO')
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function getSyncDays(marketplace: MarketplaceType, days = 30): Promise<SyncDay[]> {
  if (!supabaseConfigured) return []

  const shopId = await getShopId(marketplace)
  if (!shopId) return []

  const since = new Date()
  since.setDate(since.getDate() - days + 1)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sync_days')
    .select('*')
    .eq('shop_id', shopId)
    .gte('sync_date', since.toISOString().slice(0, 10))
    .order('sync_date', { ascending: true })

  if (error || !data) return []

  return data.map(row => {
    const raw = row.status as string
    const status: SyncDay['status'] =
      raw === 'success' ? 'ready' :
      raw === 'ready' || raw === 'degraded' || raw === 'error' || raw === 'pending'
        ? raw as SyncDay['status']
        : 'pending'
    return {
      date:          row.sync_date as string,
      status,
      productsCount: row.products_count !== null ? Number(row.products_count) : undefined,
      revenue:       row.revenue !== null ? Number(row.revenue) : undefined,
      adSpend:       row.ad_spend !== null ? Number(row.ad_spend) : undefined,
      errorMessage:  (row.error_message as string) ?? undefined,
    }
  })
}

export async function resyncDays(marketplace: MarketplaceType, dates: string[]): Promise<void> {
  if (!supabaseConfigured || dates.length === 0) return

  const shopId = await getShopId(marketplace)
  if (!shopId) return

  const supabase = createAdminClient()
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
