// Colour variants of one product IN ONE STORE become a group on the Products
// table.
//
// variant_group_key is already namespaced per marketplace — uzum:<cardId>,
// yandex:<modelName> (see lib/uzum/sync.ts and lib/yandex/sync.ts) — so
// bucketing on it alone gives exactly "same store, same product" with no
// cross-marketplace bleed. That is the whole trick, and it is why this needs no
// union-find: the store separation is already encoded in the key. The
// marketplace is folded into the bucket id regardless, so a future key format
// that drops its namespace can't silently merge two stores into one row.
//
// This is deliberately NOT lib/variant-grouping.ts. That one exists to weld
// listings ACROSS marketplaces via a shared SKU, which is right for the
// analytics tables — one product, wherever it sold. Here the store is the point:
// a seller reading this table wants "my Uzum listing" and "my Yandex listing"
// kept apart, because their prices, stock, and edits are separate things.

export interface StoreVariantRow {
  variant_group_key?: string | null
  marketplace?: string | null
}

export type StoreVariantItem<T extends StoreVariantRow> =
  | { type: 'flat'; product: T }
  | { type: 'group'; key: string; children: T[] }

export function bucketOf(p: StoreVariantRow): string | null {
  return p.variant_group_key ? `${p.marketplace ?? '?'}::${p.variant_group_key}` : null
}

/**
 * Buckets rows into per-store variant groups, preserving the incoming order:
 * a group takes the position of its first member, so an existing sort is not
 * scrambled. A group forms only at 2+ members — a lone listing stays a plain
 * row rather than growing a chevron that hides nothing. A null group key means
 * "never group", the same rule the rest of the app uses for unkeyed products.
 */
export function groupByStoreVariant<T extends StoreVariantRow>(rows: T[]): StoreVariantItem<T>[] {
  const counts = new Map<string, number>()
  for (const p of rows) {
    const b = bucketOf(p)
    if (b) counts.set(b, (counts.get(b) ?? 0) + 1)
  }

  const emitted = new Set<string>()
  const items: StoreVariantItem<T>[] = []
  for (const p of rows) {
    const b = bucketOf(p)
    if (b && (counts.get(b) ?? 0) >= 2) {
      if (emitted.has(b)) continue
      emitted.add(b)
      items.push({ type: 'group', key: b, children: rows.filter(x => bucketOf(x) === b) })
    } else {
      items.push({ type: 'flat', product: p })
    }
  }
  return items
}
