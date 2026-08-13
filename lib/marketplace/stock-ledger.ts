import type { MarketplaceType } from '@/lib/types'

/**
 * Event-sourced on-hand ledger for the FBS shared pool.
 *
 * WHY: products.physical_stock only ever mirrored each marketplace's own listing,
 * so a sale on one marketplace never debited the shared pool — both listings sat
 * stale-high and the sync re-propagated the pre-sale number. There was NO
 * decrement anywhere (proven in physical-stock.ts: the only writers copy the
 * listing; none fire on an order). This ledger makes the group's on-hand
 * authoritative: every real movement is one append-only event and
 * `on_hand = Σ delta`.
 *
 * MODEL — decisions locked with the owner:
 *   • Option A — debit at PLACEMENT, anchored to new-order detection (the event
 *     that already works), NOT a handover/delivered status transition (the kind
 *     this bug and the Yandex PICKUP dead-branch proved get missed). The
 *     reservation and the debit are the SAME event, so there is no separate
 *     "pending" term: available = max(0, on_hand).
 *   • A missed CREDIT (a cancel/return we don't catch) leaves on_hand too low →
 *     undersell, never oversell. That failure-mode asymmetry is the whole reason
 *     Option A wins over debiting at handover/delivered.
 *   • Returns credit back ONLY when the unit re-enters sellable stock.
 *   • Seed is seller-confirmed.
 *
 * This module is PURE (no DB) so it is unit-tested like stock-allocation.ts. The
 * sync layer supplies the already-recorded events + the current orders and
 * persists whatever diffLedger() returns.
 */

export type LedgerReason = 'seed' | 'consume' | 'return' | 'cancel' | 'manual'

export interface LedgerEvent {
  delta: number
  reason: LedgerReason
  /** null for seed/manual; the marketplace order id for consume/return/cancel. */
  orderIdExternal?: string | null
}

/** on_hand(group) = Σ delta over every ledger event. */
export function ledgerOnHand(events: readonly LedgerEvent[]): number {
  return events.reduce((sum, e) => sum + e.delta, 0)
}

/**
 * Free-to-sell derived from on-hand. Under Option A on_hand already nets out
 * every placed order (debit at placement), so nothing further is subtracted.
 * Never negative.
 */
export function availableFromOnHand(onHand: number): number {
  return Math.max(0, onHand)
}

/**
 * How an order maps onto the ledger:
 *   • live      — a real order competing for / consuming a unit
 *                 (pending | confirmed | delivered).
 *   • cancelled — order cancelled; releases a unit it had consumed.
 *   • returned  — delivered unit came back; credits only if restockable.
 */
export type OrderLedgerStatus = 'live' | 'cancelled' | 'returned'

export interface GroupOrder {
  orderIdExternal: string
  marketplace: MarketplaceType
  /** units of THIS group on the order (order_items.quantity). */
  qty: number
  status: OrderLedgerStatus
  /** returned orders only: does the unit re-enter sellable stock? Sellable-only
   *  credit — a write-off / non-restock return must NOT credit. Ignored unless
   *  status === 'returned'. */
  restockable?: boolean
}

export type OrderDrivenReason = 'consume' | 'return' | 'cancel'

export interface PendingLedgerWrite {
  delta: number
  reason: OrderDrivenReason
  orderIdExternal: string
  marketplace: MarketplaceType
}

/** Key identifying an already-recorded order-driven event (dedup + idempotency). */
export function ledgerKey(reason: OrderDrivenReason, orderIdExternal: string): string {
  return `${reason}:${orderIdExternal}`
}

/**
 * Diff the group's CURRENT orders against the order-driven events already
 * recorded, returning only the NEW events to append. Idempotent: a (reason,
 * order) already in `recordedKeys` is never re-emitted, so a re-sync is a no-op.
 *
 * Rules (Option A — debit at placement):
 *   • live & not yet consumed                          → consume (−qty)
 *   • cancelled & was consumed & not yet credited      → cancel  (+qty)  [release]
 *   • cancelled & never consumed                       → skip            [never competed]
 *   • returned & was consumed & restockable & not credited → return (+qty)
 *   • returned & not restockable (or never consumed)   → skip            [sellable-only / net-zero]
 *
 * A consume that was recorded for an order which later vanishes from the feed is
 * intentionally NOT auto-credited here — leaving it debited biases to undersell,
 * the safe direction. Explicit reconciliation is a separate concern.
 */
export function diffLedger(
  orders: readonly GroupOrder[],
  recordedKeys: ReadonlySet<string>,
): PendingLedgerWrite[] {
  const writes: PendingLedgerWrite[] = []
  for (const o of orders) {
    const consumed = recordedKeys.has(ledgerKey('consume', o.orderIdExternal))
    if (o.status === 'live') {
      if (!consumed) {
        writes.push({ delta: -o.qty, reason: 'consume', orderIdExternal: o.orderIdExternal, marketplace: o.marketplace })
      }
    } else if (o.status === 'cancelled') {
      if (consumed && !recordedKeys.has(ledgerKey('cancel', o.orderIdExternal))) {
        writes.push({ delta: o.qty, reason: 'cancel', orderIdExternal: o.orderIdExternal, marketplace: o.marketplace })
      }
    } else { // returned
      if (consumed && o.restockable && !recordedKeys.has(ledgerKey('return', o.orderIdExternal))) {
        writes.push({ delta: o.qty, reason: 'return', orderIdExternal: o.orderIdExternal, marketplace: o.marketplace })
      }
    }
  }
  return writes
}
