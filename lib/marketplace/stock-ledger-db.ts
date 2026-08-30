/**
 * The only DB-touching ledger module (spec §11). Reads a user's events, seeds a
 * group, appends the order-driven diff, and appends a manual drift credit. All
 * the arithmetic lives in the pure `stock-ledger.ts`; this file only persists.
 *
 * Kept separate from the pure module so the logic stays unit-testable with no DB,
 * and separate from `ledger-shadow.ts` (the log-only observer) so the real
 * write-path wiring has one clear home.
 */

import { and, eq } from 'drizzle-orm'
import { db, stockLedger } from '@/lib/db'
import { ledgerKey, type LedgerEvent, type LedgerReason, type OrderDrivenReason, type PendingLedgerWrite } from '@/lib/marketplace/stock-ledger'
import type { MarketplaceType } from '@/lib/types'

/** One open reserving order to seed a consume marker for (spec §3.1). */
export interface SeedConsume {
  orderIdExternal: string
  marketplace: MarketplaceType
  qty: number
}

/** Every ledger event for a user, grouped by match_key. */
export async function readLedgerEventsByKey(userId: string): Promise<Map<string, LedgerEvent[]>> {
  const rows = await db.select({
    match_key: stockLedger.match_key,
    delta: stockLedger.delta,
    reason: stockLedger.reason,
    order_id_external: stockLedger.order_id_external,
  }).from(stockLedger).where(eq(stockLedger.user_id, userId))

  const out = new Map<string, LedgerEvent[]>()
  for (const r of rows) {
    const list = out.get(r.match_key) ?? []
    list.push({ delta: r.delta, reason: r.reason as LedgerReason, orderIdExternal: r.order_id_external })
    out.set(r.match_key, list)
  }
  return out
}

/** A group is on the ledger once it carries a seed row. */
export function isSeeded(events: readonly LedgerEvent[]): boolean {
  return events.some(e => e.reason === 'seed')
}

/** Idempotency keys for the order-driven events already recorded for a group. */
export function recordedOrderKeys(events: readonly LedgerEvent[]): Set<string> {
  return new Set(
    events
      .filter(e => e.reason === 'consume' || e.reason === 'cancel' || e.reason === 'return')
      .map(e => ledgerKey(e.reason as OrderDrivenReason, e.orderIdExternal!)),
  )
}

/**
 * Seed a group in ONE transaction, idempotent (spec §3.1, §3.3).
 *
 * Writes the GROSS on-hand seed plus one consume marker per currently-open
 * reserving order, so mid-flight orders are netted by the seed itself and not
 * lost when the switch flips. The unique index does not stop a second seed
 * (seed rows carry NULL order_id_external, which Postgres treats as distinct),
 * so the transaction checks for an existing seed and no-ops if present.
 *
 * Returns true if it seeded, false if the group was already seeded.
 */
export async function seedGroup(
  userId: string,
  matchKey: string,
  grossOnHand: number,
  openConsumes: readonly SeedConsume[],
  note: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: stockLedger.id }).from(stockLedger)
      .where(and(
        eq(stockLedger.user_id, userId),
        eq(stockLedger.match_key, matchKey),
        eq(stockLedger.reason, 'seed'),
      )).limit(1)
    if (existing) return false

    await tx.insert(stockLedger).values({
      user_id: userId, match_key: matchKey, delta: grossOnHand, reason: 'seed',
      order_id_external: null, marketplace: null, note,
    })
    if (openConsumes.length > 0) {
      await tx.insert(stockLedger).values(openConsumes.map(c => ({
        user_id: userId, match_key: matchKey, delta: -Math.abs(c.qty), reason: 'consume' as const,
        order_id_external: c.orderIdExternal, marketplace: c.marketplace, note,
      }))).onConflictDoNothing()
    }
    return true
  })
}

/**
 * Append the order-driven events `diffLedger` produced (consume / cancel /
 * return). Idempotent via the (user, key, reason, order) unique index — a re-sync
 * that produces the same events is a no-op.
 */
export async function appendOrderDriven(
  userId: string,
  matchKey: string,
  writes: readonly PendingLedgerWrite[],
): Promise<void> {
  if (writes.length === 0) return
  await db.insert(stockLedger).values(writes.map(w => ({
    user_id: userId, match_key: matchKey, delta: w.delta, reason: w.reason,
    order_id_external: w.orderIdExternal, marketplace: w.marketplace, note: null,
  }))).onConflictDoNothing()
}

/**
 * Append a manual drift credit (spec §5). Increases only — the caller computes
 * the delta with `driftCredit` (0 when there is nothing to adopt) and this is a
 * hard no-op for anything ≤ 0, so a decrease can never reach the ledger here.
 */
export async function appendManualCredit(
  userId: string,
  matchKey: string,
  delta: number,
  note: string,
): Promise<void> {
  if (delta <= 0) return
  await db.insert(stockLedger).values({
    user_id: userId, match_key: matchKey, delta, reason: 'manual',
    order_id_external: null, marketplace: null, note,
  })
}
