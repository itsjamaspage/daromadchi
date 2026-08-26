import { createHash } from 'node:crypto'
import { pool } from './drizzle'

/**
 * ONE sync per shop at a time.
 *
 * cron fires `sync` and `stock-sync` every 5 minutes, and cron-runner.sh calls
 * each with `curl -m 280` — a 280-second timeout on a 300-second interval. When
 * a sync exceeds that, curl is killed but THE SERVER-SIDE REQUEST KEEPS RUNNING,
 * and twenty seconds later the next tick starts another one. The «Sinxronlash»
 * button calls the same code, so a seller can collide with a cron tick at any
 * moment. Nothing prevented either: there was no lock anywhere in lib/ or app/.
 *
 * What overlapping runs actually do, worst first:
 *
 *   • order_items are written delete-then-insert (lib/uzum/sync.ts,
 *     lib/yandex/sync.ts). Interleaving two of those pairs can drop items.
 *   • the fee backfill recomputes a rate from a shop balance the other run is
 *     concurrently changing, and both write the result.
 *   • new-order detection is stateless across ticks, so two runs can each
 *     classify the same order as new and both send the Telegram alert.
 *
 * ── Why a Postgres advisory lock, and not a table ──────────────────────────
 *
 * An advisory lock is held by a CONNECTION, so it is released automatically if
 * the process dies — no stale row, no TTL to tune, no lease to renew during a
 * sync whose duration is exactly the thing we cannot predict. A lock table
 * would need all three, and would get them wrong in the case that matters: a
 * killed process holding a lease nobody can clear.
 *
 * The lock is taken on a DEDICATED client checked out of the pool for the
 * duration, because `pg_advisory_lock` is session-scoped: taking it on one
 * pooled connection and releasing it on another silently does nothing. The
 * sync's own queries continue to use the pool as normal, so this costs one
 * connection out of ten per in-flight sync.
 *
 * `pg_try_advisory_lock` never waits. A second runner is told immediately that
 * one is already going and returns, which is the correct behaviour for a job
 * that will fire again in five minutes anyway — queueing would just build the
 * pile-up this exists to prevent.
 */

/**
 * The first half of the (int4, int4) advisory key is a SCOPE, so two different
 * kinds of lock can never collide even if their ids hash the same.
 *
 * 'shop-sync'  keyed on shops.id — the order/product sync.
 * 'stock-sync' keyed on users.id, because syncStockSyncGroups runs per USER
 *              (a group can span a seller's shops), not per shop. Locking it on
 *              a shop id would let two runs covering the same group overlap.
 */
export type LockScope = 'shop-sync' | 'stock-sync'

/** UUIDs in, int4 out — advisory locks take integers. Hash, don't parse. */
function keyOf(value: string): number {
  // Signed int4, which is what pg_try_advisory_lock(int, int) accepts.
  return createHash('sha1').update(value).digest().readInt32BE(0)
}

export type LockOutcome<T> =
  | { ran: true; value: T }
  | { ran: false }

/**
 * Run `work` while holding this shop's sync lock, or return `{ ran: false }`
 * immediately if another runner holds it.
 *
 * The lock is released whatever `work` does — returns, throws, or the process
 * dies with the connection open.
 */
export async function withLock<T>(
  scope: LockScope,
  id: string,
  work: () => Promise<T>,
): Promise<LockOutcome<T>> {
  const scopeKey = keyOf(scope)
  const key = keyOf(id)
  const client = await pool.connect()
  let held = false
  try {
    const res = await client.query<{ got: boolean }>(
      'select pg_try_advisory_lock($1, $2) as got',
      [scopeKey, key],
    )
    held = res.rows[0]?.got === true
    if (!held) return { ran: false }
    return { ran: true, value: await work() }
  } finally {
    // Unlock BEFORE release: the client goes back to the pool for reuse, and a
    // connection carrying a lock nobody remembers taking is how a deadlock that
    // survives a restart gets built. A failure here must not mask an error
    // thrown by `work`, so it is swallowed — the lock still dies with the
    // connection.
    if (held) {
      try {
        await client.query('select pg_advisory_unlock($1, $2)', [scopeKey, key])
      } catch { /* the connection is going back to the pool either way */ }
    }
    client.release()
  }
}

/** One shop's order/product sync. Every entry point routes through this. */
export function withShopLock<T>(shopId: string, work: () => Promise<T>) {
  return withLock('shop-sync', shopId, work)
}

/** One user's stock write-back run — the path that writes to a marketplace. */
export function withStockSyncLock<T>(userId: string, work: () => Promise<T>) {
  return withLock('stock-sync', userId, work)
}

/** Whether a lock is currently held. Diagnostics only. */
export async function lockHeld(scope: LockScope, id: string): Promise<boolean> {
  const { rows } = await pool.query<{ held: boolean }>(
    `select exists (
       select 1 from pg_locks
        where locktype = 'advisory' and classid = $1 and objid = $2 and granted
     ) as held`,
    // pg_locks reports the two halves UNSIGNED, so the signed int4 the lock was
    // taken with has to be converted back the same way to match.
    [keyOf(scope) >>> 0, keyOf(id) >>> 0],
  )
  return rows[0]?.held === true
}

/** Back-compat shorthand for the shop-sync scope. */
export const shopSyncLockHeld = (shopId: string) => lockHeld('shop-sync', shopId)
