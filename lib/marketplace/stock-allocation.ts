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

/**
 * Group-level REASSERT: the members to actually push this cycle.
 *
 * If ANY writable member has a real diff (willWrite), the whole group is
 * "changing" and EVERY writable member is re-pushed to its target — INCLUDING a
 * member whose `listedStock` already equals `target`. Rationale (the stale-copy
 * root cause): the marketplace where the sale happened auto-adjusts its OWN live
 * stock, but our products.stock_quantity copy for that listing can lag reality.
 * A per-member `target === listedStock` equality then wrongly skips the very
 * listing that needs re-raising — e.g. Yandex's real stock is 0 while our DB
 * still says 1, target is 1, so the equality skips it and the mirror never
 * re-raises Yandex 0→1. Reasserting the whole changing group re-pushes it
 * regardless of the (possibly-stale) equality.
 *
 * A fully-unchanged group (NO member willWrite) writes NOTHING — this stays a
 * strict no-op so idle cycles make zero marketplace calls.
 */
export function planGroupWrites(plan: StockPlan): PlannedWrite[] {
  const changing = plan.plans.some(p => p.willWrite)
  return changing ? plan.plans : []
}

/**
 * The value to write back into products.stock_quantity after a push, or null when
 * there is nothing to do. ONLY a successful push ('sent') updates our copy, and
 * only when it actually differs from what we already store — so the DB copy
 * tracks the live listing and can't drift into a false `target === listedStock`
 * skip on the next cycle (the stale-copy root cause). `status` is the writer's
 * StockWriteStatus; typed as string here to keep this module dependency-free.
 */
export function stockWriteBack(status: string, target: number, currentStock: number): number | null {
  return status === 'sent' && currentStock !== target ? target : null
}

/**
 * NEW-ORDER detection for the notification gate. Given the group's CURRENT
 * reserving-order ids and the set we've already accounted for (notified about),
 * decide whether a genuinely NEW reserving order appeared this cycle — a real
 * sale that drew down stock — and return the set to persist for next time.
 *
 *   • hasNewOrder — true iff some current id was NOT previously seen. This is the
 *     PRIMARY notification gate: a pure reconcile write (a stock correction with
 *     no new order) leaves the set unchanged → hasNewOrder=false → SILENT.
 *   • nextSeen — the current reserving set. Ids that LEFT the window (order
 *     delivered) are pruned; an id never re-enters reserving once delivered, so
 *     pruning can't resurrect a stale "new". Keeps the set bounded by open orders.
 *
 * Order arrival/removal within one cycle is handled by id identity, not counts or
 * timestamps: A delivered + B arrived in the same window still flags B as new
 * (different id) even though the count is unchanged.
 */
export function detectNewOrders(
  currentIds: readonly string[],
  seenIds: readonly string[],
): { hasNewOrder: boolean; nextSeen: string[] } {
  const seen = new Set(seenIds)
  const hasNewOrder = currentIds.some(id => !seen.has(id))
  return { hasNewOrder, nextSeen: [...new Set(currentIds)] }
}
