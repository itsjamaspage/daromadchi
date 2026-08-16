/**
 * Pure merge for the Uzum settlement sync — NO db, NO network. Testable in
 * isolation (mirrors lib/db/payout-status.ts).
 *
 * Why this exists: an Uzum finance order can flip status weeks AFTER delivery
 * (PROCESSING → TO_WITHDRAW), when its transaction/payout date is already outside
 * a 14-day window. The dated call then never re-fetches it, and the old undated
 * fallback (a) only ran when the dated call returned ZERO rows and (b) re-filtered
 * its results back into the same window — so a late-flipping old order could never
 * refresh and its stored status went stale. Order 117751391 is the exact case.
 *
 * The fix: ALWAYS pull a bounded, recent-first undated pass and merge it with the
 * dated pass, deduped by order-item id, and DO NOT re-filter by the date window.
 * A recently-changed order shows up in Uzum's recent set regardless of its old
 * date, so its status refreshes.
 */

/** Minimal shape needed to merge — the real UzumFinanceOrderItem satisfies it. */
export interface MergeableFinanceItem {
  id: number
}

/**
 * Merge the dated-window pass and the undated recent pass into the set to upsert.
 * Deduped by `id` (the two passes overlap). NOT window-filtered — that omission
 * is the fix: a late-flipping order (old date, freshly-changed status) survives.
 * Later occurrences win, but both passes are the same live call so the status is
 * identical; dedupe only avoids redundant upserts.
 */
export function mergeSettlementItems<T extends MergeableFinanceItem>(
  dated: readonly T[],
  undated: readonly T[],
): T[] {
  const byId = new Map<number, T>()
  for (const it of dated) if (it.id != null) byId.set(it.id, it)
  for (const it of undated) if (it.id != null) byId.set(it.id, it)
  return [...byId.values()]
}

// Uzum /v1/finance/orders statuses that are TERMINAL for our purposes — they no
// longer change, so once stored we never need to re-fetch them. Everything else
// (PROCESSING, and any unknown/future status → treated as non-terminal to be
// safe) MUST keep being refreshed until it reaches one of these.
export const TERMINAL_UZUM_STATUSES = new Set(['TO_WITHDRAW', 'CANCELED', 'PARTIALLY_CANCELLED'])

export function isTerminalUzumStatus(status: string | null | undefined): boolean {
  return !!status && TERMINAL_UZUM_STATUSES.has(status)
}

export interface UndatedPage<T> {
  items: T[]
  totalElements: number
}

export interface CollectOpts {
  /** Always fetch at least this many pages — the baseline recent sweep that
   *  discovers new orders beyond the dated window. */
  minPages: number
  /** Hard backstop so a huge-history shop can't page forever / time out. */
  maxPages: number
  /** Optional wall-clock guard; when it returns true, stop paging. */
  deadlineHit?: () => boolean
}

/**
 * Page the undated recent feed until EVERY must-cover (non-terminal) order has
 * been re-seen — not just for a fixed number of pages. This removes the
 * invisible ceiling: with a plain page cap, a shop with more recent activity
 * than the cap would let an old non-terminal order fall off the end and go stale
 * again. Here correctness depends on coverage, not the cap; the cap is only a
 * safety backstop, and `hitCap` flags when it stopped us short so the caller can
 * warn.
 *
 * Always fetches at least `minPages` (baseline sweep to discover new orders),
 * then continues up to `maxPages` only while non-terminal orders remain uncovered.
 * `fetchPage` is injected so this is unit-testable with no network.
 */
export async function collectUndatedUntilCovered<T extends MergeableFinanceItem>(
  fetchPage: (page: number) => Promise<UndatedPage<T>>,
  mustCover: ReadonlySet<number>,
  opts: CollectOpts,
): Promise<{ items: T[]; coveredAll: boolean; pagesFetched: number; hitCap: boolean }> {
  const items: T[] = []
  const remaining = new Set(mustCover)
  let pagesFetched = 0
  let exhausted = false
  for (let page = 0; page < opts.maxPages; page++) {
    if (opts.deadlineHit?.()) break
    const r = await fetchPage(page)
    pagesFetched++
    if (r.items.length === 0) { exhausted = true; break }
    for (const it of r.items) { items.push(it); if (it.id != null) remaining.delete(it.id) }
    // Fetched everything Uzum has for this feed — any still-uncovered ids are
    // orders Uzum no longer returns, not a cap problem.
    if (r.totalElements > 0 && items.length >= r.totalElements) { exhausted = true; break }
    // Past the baseline sweep, keep paging ONLY while non-terminal orders remain.
    if (pagesFetched >= opts.minPages && remaining.size === 0) break
  }
  const coveredAll = remaining.size === 0
  // hitCap = we stopped at the hard cap with orders still uncovered (the ceiling).
  const hitCap = !coveredAll && !exhausted && pagesFetched >= opts.maxPages
  return { items, coveredAll, pagesFetched, hitCap }
}
