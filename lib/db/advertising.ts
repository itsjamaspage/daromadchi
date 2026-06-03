import { createClient } from '@/lib/supabase/server'
import type { AdCampaign, MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

async function getShopIds(marketplace?: MarketplaceType): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  let q = supabase.from('shops').select('id').eq('user_id', user.id)
  if (marketplace) q = q.eq('marketplace', marketplace)
  const { data } = await q
  return (data ?? []).map((s: { id: string }) => s.id)
}

export async function getAdCampaigns(marketplace?: MarketplaceType): Promise<AdCampaign[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select('*')
    .in('shop_id', shopIds)
    .order('spend', { ascending: false })

  if (error || !data) return []

  return data.map(row => ({
    id:           row.id as string,
    name:         row.name as string,
    type:         row.type as 'cpc' | 'cpo',
    status:       row.status as 'active' | 'paused' | 'stopped',
    productTitle: (row.product_title as string) ?? '',
    spend:        Number(row.spend),
    impressions:  Number(row.impressions),
    clicks:       Number(row.clicks),
    ctr:          Number(row.ctr),
    orders:       Number(row.orders),
    revenue:      Number(row.revenue),
    drr:          Number(row.drr),
    startDate:    (row.start_date as string) ?? '',
  }))
}
