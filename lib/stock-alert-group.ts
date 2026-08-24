/**
 * Merge per-listing stock alerts into one row per physical product.
 *
 * getStockAlerts() returns one row per PRODUCT LISTING — per shop, per
 * marketplace. That is right for /dashboard/alerts, which shows the per-channel
 * breakdown and flags shared stock. On the notifications page it is noise: the
 * same earphones appear twice, once titled in Russian from Yandex and once in
 * Uzbek from Uzum, and a seller reads that as two problems.
 *
 * Worse, the two rows can disagree. Each carries its own listing's available
 * count, so one can read «Critical» and the other «Watch» for one box of stock
 * on a shelf.
 *
 * ── What "same product" means ───────────────────────────────────────────────
 * The same normalized SKU key the rest of the app groups on — trimmed,
 * lower-cased, separators stripped (matching normalizeKey in
 * lib/marketplace/stock-sync.ts and the key in lib/db/products.ts). A row with
 * no SKU cannot be grouped and stays on its own, keyed by product id, because
 * merging unidentified rows together would invent a relationship.
 *
 * ── Which values survive ────────────────────────────────────────────────────
 * The MOST URGENT ones. Stock is the group's minimum available — if any channel
 * is sold out the seller has a problem there — and daysLeft is the minimum too.
 * Taking a maximum or an average would let a healthy listing mask an empty one,
 * which is the failure this page exists to prevent.
 */
import type { StockAlert } from '@/lib/types'

export function stockAlertKey(a: Pick<StockAlert, 'sku' | 'productId'>): string {
  const norm = (a.sku ?? '').trim().toLowerCase().replace(/[\s\-_./]+/g, '')
  // No SKU → ungroupable. Namespaced so it can never collide with a real key.
  return norm || `#${a.productId}`
}

export function groupStockAlerts(alerts: StockAlert[]): StockAlert[] {
  const byKey = new Map<string, StockAlert>()
  const marketplaces = new Map<string, Set<string>>()

  for (const a of alerts) {
    const key = stockAlertKey(a)
    const seen = marketplaces.get(key) ?? new Set<string>()
    seen.add(a.marketplace)
    marketplaces.set(key, seen)

    const prev = byKey.get(key)
    if (!prev) { byKey.set(key, { ...a }); continue }
    byKey.set(key, {
      ...prev,
      // Worst case wins on both — see the note above.
      currentStock: Math.min(prev.currentStock, a.currentStock),
      daysLeft:     Math.min(prev.daysLeft, a.daysLeft),
      // Keep the longer title: the per-marketplace names differ, and the fuller
      // one identifies the product better than an abbreviated listing name.
      productTitle: a.productTitle.length > prev.productTitle.length ? a.productTitle : prev.productTitle,
      // Physical total is a group figure already; both rows carry the same one.
      totalPhysical: Math.max(prev.totalPhysical ?? 0, a.totalPhysical ?? 0),
    })
  }

  // isShared now means what it says on a merged row: listed on more than one
  // marketplace. Recomputed here rather than inherited, because the flag on an
  // individual row was about SKU sharing, not about this merge.
  const out = [...byKey.entries()].map(([key, a]) => ({
    ...a,
    isShared: (marketplaces.get(key)?.size ?? 1) > 1,
  }))

  return out.sort((x, y) => x.daysLeft - y.daysLeft)
}
