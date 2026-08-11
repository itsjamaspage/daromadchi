// Central list of the marketplace integrations the app exposes. Sourced from a
// single place so tabs, filters and sync targets stay in sync.
//
// (Wildberries was removed entirely — its per-seller rate limiter kept locking
//  the app into multi-hour throttled states and the finance endpoints we needed
//  were gated behind restricted tokens. Uzum and Yandex Market remain.)
import type { MarketplaceType } from '@/lib/types'

export function enabledMarketplaces(): MarketplaceType[] {
  return ['uzum', 'yandex_market']
}

export function isMarketplaceEnabled(mp: string | undefined | null): boolean {
  if (!mp) return true // "all" tab still ok
  return mp === 'uzum' || mp === 'yandex_market'
}
