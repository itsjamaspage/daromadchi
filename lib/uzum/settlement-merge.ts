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
