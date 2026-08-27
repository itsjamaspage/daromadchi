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
 * normalized 5-value enum, because the enum is too coarse to express the
 * boundary we need.
 *
 * ── The boundary: reserve as soon as the order is PAID & COMMITTED, never while
 *    it is still an unpaid draft. ───────────────────────────────────────────────
 * A unit is reserved the moment a real, paid order commits to it — at order
 * ingestion, NOT at PVZ hand-off — so the sibling listing on the other
 * marketplace drops right away and the last-unit oversell window closes. But an
 * order the buyer has NOT paid for must never reserve: this seller gets a steady
 * stream of unpaid-then-cancelled drafts, and reserving those would briefly zero
 * the sibling listing and suppress real sales (a phantom-stockout). So the set
 * starts at the first PAID state and deliberately excludes every unpaid/draft
 * state.
 *
 *   Uzum   → PACKING           («В сборке» — the seller is assembling a PAID,
 *                              accepted order; Uzum is prepaid, so an order the
 *                              seller is packing has been paid for).
 *            PENDING_DELIVERY  (packed, awaiting the courier).
 *            DELIVERING        («В поставке» — in transit to the PVZ).
 *            ACCEPTED_AT_DP    («Приняты Uzum» — PVZ received; also the later
 *                              «Ждут выдачи», which stays ACCEPTED_AT_DP).
 *            HANDED_OVER / TRANSFERRED — defensive aliases for the hand-off.
 *            EXCLUDES CREATED / NEW / PENDING — the freshly-placed state that
 *            still covers the unpaid / payment-processing window Uzum
 *            auto-cancels. Reserve only once the seller is actually fulfilling.
 *   Yandex → PROCESSING        («находится в обработке» — the ONLY status a
 *                              seller ships from; a prepaid order reaches it only
 *                              AFTER payment. See lib/marketplace/
 *                              fulfillment-statuses.ts).
 *            DELIVERY          — shipped / handed to the delivery service.
 *            PICKUP            — waiting at the pickup point, ordered but not yet
 *                              collected: the unit is still committed.
 *            EXCLUDES UNPAID / PLACING / RESERVED — not paid or not finalised
 *            (Yandex's own pre-payment states; reserving them is the bug).
 *
 * 'delivered' («Выданы» / DELIVERED — customer collected) is already reflected
 * in the marketplace's own listed stock, so it is NOT re-counted (double-count).
 *
 * The raw strings do not collide across marketplaces (Uzum in-transit is
 * DELIVERING, Yandex reserving is DELIVERY; Uzum has no PROCESSING in its real
 * FBS enum), so one flat union set is safe.
 *
 * Trade-off (chosen deliberately): reserving at payment can briefly show the
 * sibling low if a PAID order is later cancelled before delivery — recoverable,
 * and far safer than the reverse (showing stock the seller has already sold,
 * which oversells). The oversell safety net reads the SAME set, so it too now
 * catches a double-sell at order time rather than at receipt.
 */
export const RESERVING_RAW_STATUSES = [
  // Uzum — paid & committed: seller packing → in transit → PVZ received.
  // CREATED / NEW / PENDING (unpaid draft) are deliberately NOT here.
  'PACKING', 'PENDING_DELIVERY', 'DELIVERING', 'ACCEPTED_AT_DP', 'HANDED_OVER', 'TRANSFERRED',
  // Yandex — paid & in processing, shipped, or waiting at pickup (not collected).
  // UNPAID / PLACING / RESERVED (not paid) are deliberately NOT here.
  'PROCESSING', 'DELIVERY', 'PICKUP',
] as const

export type OversellMode = 'lock_last_unit' | 'partition' | 'off'

export interface SyncMember {
  productId: string
  shopId: string
  marketplace: MarketplaceType
  apiMode: 'read_only' | 'stock_sync'
  /** Lower = higher priority. The primary (lowest) keeps the last unit. */
  priority: number
  /** What the marketplace currently lists as available (products.stock_quantity)
   *  — the OUTBOUND throttled listing (a view we write to marketplaces). This is
   *  used for the per-member write decision (willWrite), NOT as the pool. */
  listedStock: number
  /** The real on-hand pool for this member (products.physical_stock). The ONLY
   *  input to `available`. NEVER written by our own throttle/mirror writes — it
   *  moves only on a seller-originated stock change (see physicalStockFromRead).
   *  NULL until product sync self-populates it, in which case computeAvailable
   *  seeds from listedStock so behaviour degrades gracefully. */
  physicalStock: number | null
  /** Reserving order units on this listing — paid, committed orders (Uzum
   *  PACKING and later / Yandex PROCESSING and later). Unpaid drafts (Uzum
   *  CREATED, Yandex UNPAID/PLACING/RESERVED) are excluded so they don't draw
   *  down stock. See RESERVING_RAW_STATUSES. */
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
export function computeAvailable(members: SyncMember[], onHand?: number | null): number {
  // Free-to-sell is the raw pool math, clamped at 0. The UNCLAMPED value is the
  // single source of truth for BOTH free-to-sell AND oversell detection (below N
  // < 0 = the same physical unit committed more than once) — keeping them on one
  // computation is what stops the two from ever disagreeing about the pool.
  return Math.max(0, rawGroupAvailable(members, onHand))
}

/**
 * UNCLAMPED shared free-to-sell: MAX(physical pool) − SUM(pending). A NEGATIVE
 * result means more units are on open orders than physically exist — an oversell.
 * `computeAvailable` clamps this at 0; the oversell detector reads it raw.
 *
 * POOL = physical_stock (real on-hand), NOT stock_quantity (the THROTTLED / mirror
 * listing). This is the whole point: on a normal last-unit sale the listing is
 * driven to 0 on every marketplace (the sale + the mirror), while the same order
 * is still counted in `pending`. Measuring the pool off the listing would then
 * read 0 − 1 = −1 and cry "oversell" on a perfectly good sale — the false alarm
 * this function exists to prevent. physical_stock holds the true unit, so a real
 * last-unit sale reads 1 − 1 = 0 (no oversell) and a genuine double-sell reads
 * 1 − 2 = −1 (oversell). Falls back to listedStock only to SEED a member whose
 * physical_stock is still NULL.
 */
export function rawGroupAvailable(members: SyncMember[], onHand?: number | null): number {
  // LEDGER MODE (Option A): an authoritative on-hand already nets out every placed
  // order (the reservation IS the debit) — no cross-listing MAX, no pending
  // re-subtraction. It can go negative (an oversell in ledger terms), so return it
  // raw. null/undefined → fall through to the listing-derived path unchanged.
  if (onHand != null) return onHand

  if (members.length === 0) return 0
  const poolOf = (m: SyncMember) => Math.max(0, m.physicalStock ?? m.listedStock)
  const maxStock = Math.max(0, ...members.map(poolOf))
  const pending = members.reduce((s, m) => s + Math.max(0, m.pending), 0)
  return maxStock - pending
}

/**
 * The value to write into products.physical_stock given a fresh marketplace
 * listing read, or null to LEAVE IT UNTOUCHED.
 *
 * A read that EQUALS our most-recent written target is OUR OWN throttle/mirror
 * write coming back — it must never feed the pool, so return null. Any other read
 * is a SELLER-originated stock change (the seller re-stocked or adjusted their
 * listing), including the first-ever read of a product we've never written
 * (lastSentTarget = null) — adopt it as the pool.
 *
 * This is the guarantee that our own writes can never shrink the shared pool:
 * the only path that moves physical_stock ignores reads that match what we wrote.
 */
export function physicalStockFromRead(read: number, lastSentTarget: number | null): number | null {
  if (lastSentTarget != null && read === lastSentTarget) return null
  return read
}

/**
 * STOPGAP guard behind reconcilePhysicalStock (replaces the plain
 * physicalStockFromRead match). Should `read` (the freshly-synced listing) be
 * adopted as the on-hand pool?
 *
 * The old rule adopted every read that wasn't an EXACT match to our last write.
 * That collapsed the pool on a marketplace ORDER-DECREMENT: after we push
 * `available`, the marketplace nets the SAME accepted order off its listing
 * again, so the listing reads below our write and the old rule mistook it for a
 * seller change and pulled it into physical_stock (the KBWHT 2→1→0 ratchet).
 *
 * This adds a `pending`-aware band: a DOWNWARD move no deeper than the units on
 * open reserving orders for this listing is the marketplace netting an order we
 * already know about — NOT the seller — so it is ignored. Genuine seller changes
 * (a restock UP, or a drop BEYOND pending) are still adopted.
 *
 * ⚠️ This is a value-comparison heuristic, and the listing carries one number
 * with two meanings, so two cases are UNAVOIDABLY wrong and are accepted here:
 *   1. A genuine seller REDUCTION while an order is open, landing within the band
 *      (sold one elsewhere, damaged unit), is read as an order-decrement and
 *      SILENTLY IGNORED — today's bug in reverse.
 *   2. A marketplace RESTORE on cancellation is an upward move, adopted as a
 *      restock, ratcheting the pool UP — the same failure, other direction.
 * Only an event ledger (which tracks the events instead of inferring them from
 * the value) closes these. This stops the current bleeding; it is not the fix.
 */
export function shouldAdoptPhysicalStock(read: number, lastWrite: number | null, pending: number): boolean {
  if (lastWrite != null && read === lastWrite) return false            // our own write coming back
  // Order-decrement band: a drop no deeper than the open reserving units on this
  // listing is the marketplace netting a known order, not a seller change.
  if (lastWrite != null && pending > 0 && read < lastWrite && (lastWrite - read) <= pending) return false
  return true                                                          // seller change → adopt
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
export function planStockWrites(members: SyncMember[], mode: OversellMode, onHand?: number | null): StockPlan {
  const available = computeAvailable(members, onHand)
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
