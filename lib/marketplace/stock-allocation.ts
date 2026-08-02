/**
 * Pure stock-sync planning — no DB, no network, no side effects.
 *
 * Given the members of one cross-marketplace SKU group (the same physical
 * product listed on Uzum / Yandex Market), it computes:
 *   Step A — the shared `available` number (the read-only leftover math), and
 *   Step B — the target ostatok to write to each stock_sync store, per the
 *            group's oversell_mode, writing ONLY where the listed number differs.
 *
 * Keeping this pure makes the oversell rules unit-testable and lets the dry-run
 * demo exercise the exact decisions the orchestrator will make.
 */

import type { MarketplaceType } from '@/lib/types'

export type OversellMode = 'lock_last_unit' | 'partition' | 'off'

export interface SyncMember {
  productId: string
  shopId: string
  marketplace: MarketplaceType
  apiMode: 'read_only' | 'stock_sync'
  /** Lower = higher priority. The primary (lowest) keeps the last unit. */
  priority: number
  /** What the marketplace currently lists as available (products.stock_quantity). */
  listedStock: number
  /** Open (pending/confirmed) order units on this listing. */
  pending: number
  sku: string | null
}

export interface PlannedWrite {
  member: SyncMember
  /** Target ostatok for this store under the group's oversell_mode. */
  target: number
  /** True only when target differs from what's currently listed (real diff). */
  willWrite: boolean
}

export interface StockPlan {
  /** available = max(0, MAX(stock across group) − SUM(all pending across group)) */
  available: number
  /** One entry per stock_sync member, ordered by priority (primary first). */
  plans: PlannedWrite[]
}

/**
 * available = max(0, MAX(listed stock across the WHOLE group) − SUM(all pending
 * across the WHOLE group)). MAX because a shared-FBS unit is listed as "N
 * available" on every marketplace from one physical pool; SUM(pending) because
 * every open order anywhere draws from that pool.
 */
export function computeAvailable(members: SyncMember[]): number {
  if (members.length === 0) return 0
  const maxStock = Math.max(0, ...members.map(m => Math.max(0, m.listedStock)))
  const pending = members.reduce((s, m) => s + Math.max(0, m.pending), 0)
  return Math.max(0, maxStock - pending)
}

// Deterministic ordering: priority asc, then Uzum before others (so Uzum is the
// default primary), then shopId for a stable final tiebreak.
function byPriority(a: SyncMember, b: SyncMember): number {
  if (a.priority !== b.priority) return a.priority - b.priority
  if (a.marketplace !== b.marketplace) return a.marketplace === 'uzum' ? -1 : b.marketplace === 'uzum' ? 1 : 0
  return a.shopId.localeCompare(b.shopId)
}

function allocateTargets(available: number, sorted: SyncMember[], mode: OversellMode): Map<string, number> {
  const out = new Map<string, number>()
  if (sorted.length === 0) return out

  if (mode === 'off') {
    for (const m of sorted) out.set(m.shopId, available)
    return out
  }

  if (mode === 'lock_last_unit') {
    if (available <= 0) {
      for (const m of sorted) out.set(m.shopId, 0)          // ==0 → 0 everywhere
    } else if (available === 1) {
      sorted.forEach((m, i) => out.set(m.shopId, i === 0 ? 1 : 0)) // ==1 → 1 to primary, 0 to others
    } else {
      for (const m of sorted) out.set(m.shopId, available)  // >=2 → available to all
    }
    return out
  }

  // partition: split so the sum never exceeds available, as evenly as possible,
  // remainder going to the higher-priority channels first.
  const n = sorted.length
  const base = Math.floor(available / n)
  const rem = available % n
  sorted.forEach((m, i) => out.set(m.shopId, base + (i < rem ? 1 : 0)))
  return out
}

/**
 * Plan the writes for one SKU group. Read-only members are never written (they
 * only feed the shared `available`); only stock_sync members get a target, and
 * only a real diff (target !== listed) becomes an actual write.
 */
export function planStockWrites(members: SyncMember[], mode: OversellMode): StockPlan {
  const available = computeAvailable(members)
  const writable = members.filter(m => m.apiMode === 'stock_sync').sort(byPriority)
  const targets = allocateTargets(available, writable, mode)
  const plans: PlannedWrite[] = writable.map(m => {
    const target = targets.get(m.shopId) ?? available
    return { member: m, target, willWrite: target !== m.listedStock }
  })
  return { available, plans }
}
