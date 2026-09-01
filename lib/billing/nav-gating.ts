/**
 * Which dashboard nav entries lead to a locked page.
 *
 * The pages gate themselves — this only decides what the sidebar SHOWS, so a
 * seller sees the lock before the click instead of walking into a wall. It is
 * deliberately advisory: an empty list here never grants access to anything,
 * because every gated page re-checks entitlement on its own.
 *
 * Keys are the sidebar's own nav keys, not Feature names, because two entries
 * (P&L and payouts) map to the single 'finances' capability.
 */
import { loadEntitlement, everyActiveShopIsReadOnly } from './entitlement'
import { hasFeature } from './features'

export async function lockedNavKeys(userId: string | null): Promise<string[]> {
  if (!userId) return []

  const entitlement = await loadEntitlement(userId)
  const locked: string[] = []

  if (!hasFeature(entitlement, 'analytics')) locked.push('analytics')
  if (!hasFeature(entitlement, 'unit_economics')) locked.push('unitEconomics')
  // Stocks follows the page's own rule: it survives the gate while one active
  // shop is still in stock_sync mode, so the lock icon must not appear then.
  if (!hasFeature(entitlement, 'stock_sync') && await everyActiveShopIsReadOnly(userId)) {
    locked.push('stocks')
  }

  return locked
}
