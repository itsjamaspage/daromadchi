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

/**
 * RAW marketplace order statuses whose units RESERVE shared stock (draw down
 * `available`, and so lower the ostatok written to the other marketplaces in the
 * group). Keyed off the RAW status (orders.marketplace_status), NOT the
 * normalized 5-value enum, because the enum is too coarse: on Uzum FBS both
 * «В поставке» (DELIVERING, still in transit to the PVZ) and «Приняты Uzum»
 * (ACCEPTED_AT_DP, the PVZ has received the item) normalize to 'confirmed', yet
 * the seller's rule is that stock must NOT draw down until PVZ receipt.
 *
 * The boundary is PVZ RECEIPT and later, never earlier:
 *   Uzum   → ACCEPTED_AT_DP   («Приняты Uzum» — PVZ received; also covers the
 *                              later «Ждут выдачи» which stays ACCEPTED_AT_DP).
 *            HANDED_OVER / TRANSFERRED — defensive aliases for "the seller has
 *                              handed the item over at the pickup point".
 *            EXCLUDES DELIVERING / SENT / ON_DELIVERY (still «В поставке»,
 *            in transit) and everything at «Новые» / «В сборке».
 *   Yandex → DELIVERY         — the order has been shipped / handed off to the
 *                              delivery service (the physical hand-off boundary).
 *
 * 'delivered' («Выданы» — customer collected) is already reflected in the
 * marketplace's own listed stock, so it is NOT re-counted here (double-subtract).
 *
 * The raw strings do not collide across marketplaces (Uzum in-transit is
 * DELIVERING, Yandex reserving is DELIVERY), so one flat union set is safe.
 *
 * Trade-off: keeping listings full until PVZ receipt means the same physical
 * unit can be ordered on both marketplaces before either is received; the
 * oversell safety net (which reads the SAME set) resolves that at receipt time.
 */
export const RESERVING_RAW_STATUSES = [
  // Uzum — PVZ has received the item («Приняты Uzum») and later
  'ACCEPTED_AT_DP', 'HANDED_OVER', 'TRANSFERRED',
  // Yandex — shipped / handed off to delivery
  'DELIVERY',
] as const

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
  /** Reserving order units on this listing — those the PVZ has received
   *  (Uzum ACCEPTED_AT_DP / Yandex DELIVERY) and later. Orders still in transit
   *  to the PVZ or with the seller are excluded so they don't draw down stock.
   *  See RESERVING_RAW_STATUSES. */
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
    let target = targets.get(m.shopId) ?? available
    // Backstop: never RAISE a listing that has an open reserving order against
    // it — a unit on it is already committed at the PVZ, so raising would
    // un-reserve it and risk an oversell. Only lower or hold. Legitimate restock
    // increases are still allowed when the listing has no open reserving orders.
    //
    // SKIPPED in 'off' (mirror-always) mode: the owner accepts the last-unit
    // oversell so every writable channel mirrors the true free-to-sell number —
    // even a member holding a reserve re-raises to `available` (this is what lets
    // Yandex re-raise 0→1 to match Uzum). The backstop still applies for
    // lock_last_unit / partition.
    if (mode !== 'off' && m.pending > 0 && target > m.listedStock) target = m.listedStock
    return { member: m, target, willWrite: target !== m.listedStock }
  })
  return { available, plans }
}
