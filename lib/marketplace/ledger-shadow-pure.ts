/**
 * Pure shaping for the shadow evaluator (lib/marketplace/ledger-shadow.ts).
 *
 * SHADOW MODE ONLY — increment 2. This computes what the event ledger WOULD say
 * and logs it next to the legacy pool number. It does NOT feed on_hand into
 * computeAvailable and it never writes to a marketplace. Its whole job is to let
 * us read the comparison on real sync passes, per ROW, before any seed data
 * exists.
 *
 * Kept DB-free so the two shaping decisions are unit-tested: (1) mapping a raw
 * order row to a GroupOrder via orderLedgerStatus (the RESERVING-anchored rule,
 * #392), and (2) emitting the comparison PER ROW, not per group — JMBLK is the
 * proof this matters: uzum physical_stock=1, yandex=2, and the group MAX shows 2,
 * so a group-level comparison would call JMBLK "matching" while one row is wrong.
 */

import { orderLedgerStatus, type GroupOrder } from '@/lib/marketplace/stock-ledger'
import type { MarketplaceType } from '@/lib/types'

/** One order's rollup for a group, straight from SQL (one row per order+group). */
export interface RawGroupOrder {
  orderIdExternal: string
  marketplace: MarketplaceType
  /** SUM(order_items.quantity) of THIS group's products on the order. */
  qty: number
  /** orders.marketplace_status (raw) — the RESERVING boundary is keyed off this. */
  rawStatus: string | null
  /** orders.status (normalized enum). */
  normalizedStatus: string
}

/**
 * Map raw order rows to GroupOrders, dropping the ones that don't touch the pool
 * (unpaid drafts → orderLedgerStatus null). `restockable` DEFAULTS TO FALSE for
 * returns — we can't yet tell a resellable return from a write-off, and the safe
 * bias is to NOT credit (under-credit → undersell, never oversell). Documented as
 * a known under-credit until a real return is observed to settle it.
 */
export function toGroupOrders(rows: readonly RawGroupOrder[]): GroupOrder[] {
  const out: GroupOrder[] = []
  for (const r of rows) {
    const status = orderLedgerStatus(r.rawStatus, r.normalizedStatus)
    if (status == null) continue                 // unpaid draft — never competes for a unit
    out.push({
      orderIdExternal: r.orderIdExternal,
      marketplace: r.marketplace,
      qty: r.qty,
      status,
      ...(status === 'returned' ? { restockable: false } : {}),
    })
  }
  return out
}

/** One listing's line in the shadow comparison — PER ROW (per marketplace listing). */
export interface ShadowMember {
  marketplace: MarketplaceType
  sku: string | null
  /** products.physical_stock for THIS listing (null until sync self-populates). */
  physicalStock: number | null
}

export interface ShadowRow {
  matchKey: string
  marketplace: MarketplaceType
  sku: string | null
  /** legacy per-listing physical_stock — the value the group MAX can hide. */
  legacyPhysicalStock: number | null
  /** legacy group free-to-sell (computeAvailable over the pool). */
  legacyAvailable: number
  /** ledger on_hand = Σ delta over the group's events (can be negative pre-seed). */
  ledgerOnHand: number
  /** ledgerOnHand − legacyAvailable. Nonzero = the two disagree for this group. */
  diff: number
}

/**
 * Emit one comparison row PER member, carrying that member's own physical_stock
 * beside the shared group figures. The group numbers (legacyAvailable, ledgerOnHand)
 * repeat across a group's rows on purpose — the per-listing physicalStock is what
 * differs, and surfacing it is the entire point (JMBLK).
 */
export function comparisonRows(
  matchKey: string,
  members: readonly ShadowMember[],
  legacyAvailable: number,
  ledgerOnHand: number,
): ShadowRow[] {
  return members.map(m => ({
    matchKey,
    marketplace: m.marketplace,
    sku: m.sku,
    legacyPhysicalStock: m.physicalStock,
    legacyAvailable,
    ledgerOnHand,
    diff: ledgerOnHand - legacyAvailable,
  }))
}

/** One-line log form for a comparison row. */
export function formatShadowRow(r: ShadowRow): string {
  return `[ledger-shadow] ${r.matchKey} ${r.marketplace} sku=${r.sku ?? '—'} ` +
    `physical=${r.legacyPhysicalStock ?? 'null'} legacyAvail=${r.legacyAvailable} ` +
    `ledgerOnHand=${r.ledgerOnHand} diff=${r.diff}`
}
