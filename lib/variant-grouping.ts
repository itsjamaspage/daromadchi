// Union-find grouping used by Analytics tables. Same logic as
// ProductsTable.groupProducts (kept here for reuse across the two
// analytics tables — the products table's own copy is left in place
// to avoid touching its already-shipped file).
//
// A "row" is anything with variant_group_key (nullable) + sku
// (nullable) + a stable id — order-based sales rows (Table 1) and
// product-margin rows (Table 2) both satisfy that shape.
//
// Rules — identical to what Products page does:
//   1. Union rows by shared variant_group_key.
//   2. Bridge across marketplaces by shared normalised SKU (so
//      uzum:<X> + yandex:<Y> collapse when both listings carry the
//      same SKU).
//   3. NULL variant_group_key ⇒ row groups by SKU alone when every row
//      sharing that SKU is also keyless (single-variant products on two
//      marketplaces, e.g. NAM90 on Uzum + Yandex). But a keyless row
//      whose SKU overlaps with a keyed row stays flat — that is the
//      orphan/"Удалённый товар" case, where an order item references a
//      deleted product that happened to carry the same SKU as a live one.
//   4. A parent forms only when ≥2 rows land in one component;
//      singletons stay flat so the table doesn't sprout meaningless
//      chevrons.
//
// `bridge` rows exist for rule 2 alone. The SKU bridge can only weld two
// marketplaces together when it can SEE a SKU on both of them, and a table
// built from sales contains only the listings that sold — so a product whose
// black variant sold on Uzum and white variant sold on Yandex arrives with the
// two welding listings absent and falls apart into two unrelated rows. Passing
// the full product list as `bridge` restores the missing links without putting
// unsold listings on screen: bridge entries join the union-find, are never
// counted toward the ≥2 threshold, and are never emitted.

export interface Groupable {
  id: string
  sku: string | null
  variant_group_key?: string | null
}

export type GroupedItem<T extends Groupable> =
  | { type: 'flat'; row: T }
  | { type: 'parent'; key: string; representative: T; children: T[] }

function normSku(s: string | null): string | null {
  if (!s) return null
  const t = s.trim().toLowerCase()
  return t.length ? t : null
}

export function groupByVariant<T extends Groupable>(
  rows: T[],
  bridge: Groupable[] = [],
): GroupedItem<T>[] {
  // Union-find sees rows + bridge; everything below the linking step sees rows.
  const linkable: Groupable[] = bridge.length ? [...rows, ...bridge] : rows
  const uf = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (uf.get(r)! !== r) r = uf.get(r)!
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) uf.set(ra, rb)
  }

  for (const p of linkable) {
    if (p.variant_group_key && !uf.has(p.variant_group_key)) {
      uf.set(p.variant_group_key, p.variant_group_key)
    }
  }

  // Detect which normalised SKUs are "mixed" — used by both keyed and keyless
  // rows. A keyless row on a mixed SKU is an orphan; it must stay flat.
  const skuHasKeyed = new Set<string>()
  const skuHasKeyless = new Set<string>()
  for (const p of linkable) {
    const nk = normSku(p.sku)
    if (!nk) continue
    if (p.variant_group_key) skuHasKeyed.add(nk)
    else skuHasKeyless.add(nk)
  }

  // SKU bridge: keys co-occurring on one normalised SKU are the same product.
  const keysBySku = new Map<string, string[]>()
  for (const p of linkable) {
    const nk = normSku(p.sku)
    if (!nk) continue
    let key: string | null = null
    if (p.variant_group_key) {
      key = p.variant_group_key
    } else if (!skuHasKeyed.has(nk)) {
      // Pure keyless SKU — all rows sharing this SKU lack a group key.
      // Give them a synthetic key so they merge by SKU.
      key = `sku:${nk}`
      if (!uf.has(key)) uf.set(key, key)
    }
    if (!key) continue
    const list = keysBySku.get(nk)
    if (list) {
      if (!list.includes(key)) list.push(key)
    } else {
      keysBySku.set(nk, [key])
    }
  }
  for (const keys of keysBySku.values()) {
    for (let j = 1; j < keys.length; j++) union(keys[0], keys[j])
  }

  const parentKeyOf = (p: T): string | null => {
    if (p.variant_group_key) return find(p.variant_group_key)
    const nk = normSku(p.sku)
    if (nk && !skuHasKeyed.has(nk)) {
      const sk = `sku:${nk}`
      if (uf.has(sk)) return find(sk)
    }
    return null
  }

  const countByParent = new Map<string, number>()
  for (const p of rows) {
    const pk = parentKeyOf(p)
    if (pk) countByParent.set(pk, (countByParent.get(pk) ?? 0) + 1)
  }

  const emitted = new Set<string>()
  const items: GroupedItem<T>[] = []
  for (const p of rows) {
    const pk = parentKeyOf(p)
    if (pk && (countByParent.get(pk) ?? 0) >= 2) {
      if (emitted.has(pk)) continue
      emitted.add(pk)
      items.push({
        type: 'parent',
        key: pk,
        representative: p,
        children: rows.filter(x => parentKeyOf(x) === pk),
      })
    } else {
      items.push({ type: 'flat', row: p })
    }
  }
  return items
}
