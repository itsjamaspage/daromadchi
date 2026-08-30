import type { MarketplaceType } from '@/lib/types'
import { RESERVING_RAW_STATUSES } from '@/lib/marketplace/stock-allocation'

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
 *   • live      — live-OPEN: reserving NOW (paid & committed, pre-delivery). It
 *                 competes for a unit and CREATES a consume.
 *   • delivered — live-CLOSED: the unit shipped and is gone. KEEP an existing
 *                 consume, but NEVER create one. Splitting this out of `live` is
 *                 the fix for the shadow's day-1 finding: an order first seen
 *                 already delivered (shadow start, backfill, at seed) used to
 *                 manufacture a debit-at-delivery, but Option A debits at
 *                 PLACEMENT and a shipped unit's departure is already in physical /
 *                 the seed baseline — so a first-seen-delivered order must record
 *                 NOTHING.
 *   • cancelled — order cancelled; releases a unit it had consumed.
 *   • returned  — delivered unit came back; credits only if restockable.
 */
export type OrderLedgerStatus = 'live' | 'delivered' | 'cancelled' | 'returned'

/**
 * Map one order (its RAW marketplace status + our normalized status) to its
 * ledger meaning, or `null` for an order that touches nothing.
 *
 * `live` is anchored to the SAME paid-and-committed gate as reserve-at-payment
 * (RESERVING_RAW_STATUSES), NOT the coarse normalized `pending`. This is the
 * consistency requirement: an UNPAID draft (Uzum CREATED, Yandex
 * UNPAID/PLACING/RESERVED — none in the reserving set, normalized `pending`)
 * returns `null` and never debits the pool, so the phantom-stockout that
 * reserve-at-payment (#347) fixed cannot come back through the ledger.
 *
 *   • cancelled                       → 'cancelled' (release a consumed unit)
 *   • returned                        → 'returned'  (credit iff restockable)
 *   • delivered (customer collected)  → 'delivered' — live-CLOSED: keep an
 *                                        existing consume, but never CREATE one.
 *                                        The unit is gone and already reflected in
 *                                        physical / the seed, so a first-seen-
 *                                        delivered order must not manufacture a
 *                                        debit-at-delivery (Option A debits at
 *                                        PLACEMENT, not at handover).
 *   • raw status in RESERVING_RAW_STATUSES → 'live' (live-OPEN, paid & committed)
 *   • anything else (unpaid draft)    → null        (nothing to record)
 */
export function orderLedgerStatus(
  rawStatus: string | null,
  normalizedStatus: string,
): OrderLedgerStatus | null {
  if (normalizedStatus === 'cancelled') return 'cancelled'
  if (normalizedStatus === 'returned') return 'returned'
  if (normalizedStatus === 'delivered') return 'delivered'
  if (rawStatus && (RESERVING_RAW_STATUSES as readonly string[]).includes(rawStatus)) return 'live'
  return null
}

/**
 * §3.2 — the GROSS seed on-hand: everything on the shelf, committed units
 * included. The consume rows written in the same seed transaction net it down.
 *   • baseline set (product_links.total_physical_stock, seller-confirmed) → use it
 *     as-is; it is already gross.
 *   • no baseline → current free-to-sell + units on open reserving orders. The
 *     listing has already had the marketplace's reservations removed, so the
 *     committed units are added back to recover the shelf count.
 * Getting this wrong in either direction invents or loses a unit per open order,
 * so the two sources are explicit.
 */
export function seedGrossOnHand(
  baseline: number | null,
  freeToSell: number,
  openReservingUnits: number,
): number {
  return baseline != null ? baseline : freeToSell + openReservingUnits
}

/**
 * §5 restock adoption — how much to CREDIT for an unexplained seller restock.
 *
 * `listingAvailable` is the highest SELLER-driven free-to-sell across the group's
 * listings. The caller builds it having already (a) EXCLUDED any listing that
 * equals a value WE wrote — a stale listing still showing our own last push is not
 * a seller restock, which is exactly the number the 0→1 incident rode on — and
 * (b) netted out reserved units, so this is AVAILABLE, never FIT (§12.1).
 *
 * A value ABOVE the ledger's available is a restock we have not ingested → credit
 * the difference so it propagates to the sibling. A value at or below is ignored:
 * a drop looks identical to an un-ingested order, and adopting it would raise the
 * sibling into an oversell. Increases only — the deliberate undersell-not-oversell
 * bias the ledger already chose.
 */
export function driftCredit(listingAvailable: number, ledgerAvailable: number): number {
  return Math.max(0, listingAvailable - ledgerAvailable)
}

export interface DriftMember {
  listedStock: number
  /** units on open reserving orders for this listing (nets a FIT read to AVAILABLE). */
  pending: number
  /** what WE last wrote to this listing, or null if never written. */
  lastWrite: number | null
}

/**
 * §5 + §12.1 — the highest SELLER-driven free-to-sell across a group's listings,
 * the number `driftCredit` compares against the ledger's available.
 *
 * Two exclusions make this safe, and both are load-bearing:
 *   • A listing still EQUAL to our own last write is dropped. A stale listing
 *     showing the value WE pushed is not a seller restock — this is the exact
 *     0→1 incident: our own write of 1 sitting on a sold-out listing must never
 *     be read back as evidence to re-credit the pool.
 *   • Reserved units are netted out (listing − pending), so a Yandex FIT read
 *     (available + reserved) is compared as AVAILABLE, never FIT (§12.1) — a
 *     permanent phantom rise of exactly the reserve would otherwise be adopted.
 */
export function sellerListingAvailable(members: readonly DriftMember[]): number {
  const seller = members
    .filter(m => m.lastWrite !== m.listedStock)
    .map(m => Math.max(0, m.listedStock - Math.max(0, m.pending)))
  return seller.length > 0 ? Math.max(0, ...seller) : 0
}

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
 *   • live (OPEN) & not yet consumed                   → consume (−qty)
 *   • delivered (live-CLOSED)                          → skip            [keep an existing
 *                                                        consume; NEVER create one — a first-
 *                                                        seen-delivered order records nothing]
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
      // live-OPEN: create a consume the first time we see the order reserving.
      if (!consumed) {
        writes.push({ delta: -o.qty, reason: 'consume', orderIdExternal: o.orderIdExternal, marketplace: o.marketplace })
      }
    } else if (o.status === 'delivered') {
      // live-CLOSED: no-op. An existing consume (recorded while the order was
      // reserving) stays untouched; a first-seen-delivered order records nothing —
      // its departure is already in physical / the seed, so creating a consume here
      // would be a debit-at-delivery (the shadow's day-1 phantom).
    } else if (o.status === 'cancelled') {
      if (consumed && !recordedKeys.has(ledgerKey('cancel', o.orderIdExternal))) {
        writes.push({ delta: o.qty, reason: 'cancel', orderIdExternal: o.orderIdExternal, marketplace: o.marketplace })
      }
    } else if (o.status === 'returned') {
      if (consumed && o.restockable && !recordedKeys.has(ledgerKey('return', o.orderIdExternal))) {
        writes.push({ delta: o.qty, reason: 'return', orderIdExternal: o.orderIdExternal, marketplace: o.marketplace })
      }
    }
  }
  return writes
}
