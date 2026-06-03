import { createClient } from '@/lib/supabase/server'
import type { SearchPhrase, MarketplaceType } from '@/lib/types'

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

export async function getSearchPhrases(marketplace?: MarketplaceType): Promise<SearchPhrase[]> {
  if (!supabaseConfigured) return []

  const shopIds = await getShopIds(marketplace)
  if (shopIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('search_phrases')
    .select('*')
    .in('shop_id', shopIds)
    .order('impressions', { ascending: false })

  if (error || !data) return []

  return data.map(row => ({
    id:           row.id as string,
    productId:    (row.product_id as string) ?? '',
    productTitle: (row.product_title as string) ?? '',
    phrase:       row.phrase as string,
    impressions:  Number(row.impressions),
    clicks:       Number(row.clicks),
    ctr:          Number(row.ctr),
    orders:       Number(row.orders),
    spend:        Number(row.spend),
  }))
}
