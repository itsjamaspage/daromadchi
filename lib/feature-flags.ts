// Central toggle for marketplace integrations. Flip to true when the
// integration is ready to leave "coming soon" state.
//
// Wildberries stays off for now: their per-seller rate limiter kept
// locking the app into a permanent throttled state (17h+ lockouts
// even with the DB-persisted cooldown), and the reports/finance
// endpoints we'd need for real settlements data are gated behind
// tokens with restrictions we haven't proven out yet. Rather than
// half-ship it, hide the integration everywhere and let the seller
// only see "Coming soon".
export const WB_ENABLED = false

// Convenience — the marketplaces the app currently exposes in every
// UI (tabs, filters, sync targets). Sourced from a single place so
// flipping WB_ENABLED to true adds it back to every consumer at once.
import type { MarketplaceType } from '@/lib/types'
export function enabledMarketplaces(): MarketplaceType[] {
  const list: MarketplaceType[] = ['uzum', 'yandex_market']
  if (WB_ENABLED) list.push('wildberries')
  return list
}

export function isMarketplaceEnabled(mp: string | undefined | null): boolean {
  if (!mp) return true // "all" tab still ok
  if (mp === 'wildberries') return WB_ENABLED
  return true
}
