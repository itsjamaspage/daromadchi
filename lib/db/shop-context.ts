import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MarketplaceType } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export interface ShopRef {
  id: string
  marketplace: MarketplaceType
}

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  if (!supabaseConfigured) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
})

// Persist shops per user across requests for 60 s to avoid a DB round-trip on
// every page navigation. getUserShops() still validates auth on every request.
const _fetchShopsByUser = unstable_cache(
  async (userId: string): Promise<ShopRef[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('shops')
      .select('id, marketplace')
      .eq('user_id', userId)
    return (data ?? []) as ShopRef[]
  },
  ['user-shops'],
  { revalidate: 60 },
)

export const getUserShops = cache(async (): Promise<ShopRef[]> => {
  const userId = await getCurrentUserId()
  if (!userId) return []
  return _fetchShopsByUser(userId)
})

/**
 * Shop ids for the current user, optionally filtered by marketplace.
 *
 * Returns `null` when there is no authenticated user, so callers can tell
 * "logged out" apart from "logged in but no shops". Derived from the memoized
 * shop list — no extra round-trips regardless of how many times it is called.
 */
export const getShopIds = cache(async (marketplace?: MarketplaceType): Promise<string[] | null> => {
  const userId = await getCurrentUserId()
  if (!userId) return null
  const shops = await getUserShops()
  const filtered = marketplace ? shops.filter(s => s.marketplace === marketplace) : shops
  return filtered.map(s => s.id)
})
