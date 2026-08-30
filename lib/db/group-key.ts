/**
 * The canonical cross-marketplace grouping key — PURE (no db, no auth imports).
 *
 * Split out of stock-groups.ts so the write path (stock-sync) and the ledger can
 * share the exact same key function WITHOUT dragging in stock-groups' db/auth
 * dependency graph (stock-groups → shop-context → auth/session → next/navigation,
 * which crashes a react-server test context). stock-groups re-exports these.
 */

export function normalizeKey(sku: string): string {
  return sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
}

/**
 * Build the merge-chain resolver for a user from their product_group_merges rows.
 * Follows source_key → target_key to the final target, cycle-guarded.
 *
 * §6 of the ledger spec: stock-sync had its OWN local normalizeKey and did NOT
 * resolve merges, while computeStockGroups does — so a group the seller merged in
 * the UI was one match_key for display and two for the sync. stock_ledger is keyed
 * on match_key, so a credit would land on a key the sync never looks up. This
 * exported resolver + matchKeyForProduct are the single key function both use.
 */
export function buildKeyResolver(
  merges: readonly { source_key: string; target_key: string }[],
): (rawKey: string) => string {
  const mergeMap = new Map(merges.map(m => [m.source_key, m.target_key]))
  return (key: string) => {
    const seen = new Set<string>()
    let k = key
    while (mergeMap.has(k) && !seen.has(k)) { seen.add(k); k = mergeMap.get(k)! }
    return k
  }
}

/** A product's merge-resolved match_key: normalized SKU (or #id when unsku'd),
 *  run through the merge resolver. The one key stock-sync, the ledger and the
 *  display all agree on. */
export function matchKeyForProduct(
  sku: string | null,
  productId: string,
  resolve: (rawKey: string) => string,
): string {
  return resolve(sku ? normalizeKey(sku) : `#${productId}`)
}
