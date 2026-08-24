import { eq, and, inArray, gte, sql, notInArray } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, productLinks, productGroupMerges } from '@/lib/db'
import { getShopIds, getCurrentUserId } from '@/lib/db/shop-context'
import type { MarketplaceType } from '@/lib/types'
import { displayReservedCondition } from '@/lib/marketplace/reserving-orders'

/*
 * Cross-marketplace leftover tracking.
 *
 * Products are grouped across the user's shops by normalized seller article
 * (SKU) — the same article on Uzum, Wildberries and Yandex Market means the
 * same physical product. All numbers here are computed from data already synced
 * from the marketplaces; this display math never writes to a store. (Writing the
 * corrected leftover back to a listing is a separate, opt-in path —
 * lib/marketplace/stock-writer.ts — used only for stock_sync shops; read-only
 * shops, the default, are never written to.)
 *
 * Two leftover modes per group:
 *  • api      — FBS/FBO-aware aggregation per member:
 *                 FBO/FBY members → SUM (independent per-marketplace warehouses)
 *                 FBS / unknown  → MAX (same physical pool on every marketplace)
 *               Total leftover = FBO sum + FBS max. Handles mixed groups too
 *               (e.g. SKU listed as FBS on Uzum and FBY on Yandex → both add).
 *  • baseline — the user entered how many units they physically own
 *               (total_physical_stock); leftover = that number minus exact
 *               units sold across ALL marketplaces since it was entered.
 *               Use for exact tracking that ignores API stock numbers.
 */

// Sold = every non-cancelled, non-returned order item. Returned units go back
// to the shelf, so they don't reduce inventory.
const NOT_SOLD_STATUSES = ['cancelled', 'returned'] as const

export interface StockGroupMember {
  product_id: string
  marketplace: MarketplaceType
  title: string
  sku: string | null
  stock: number
  sold_total: number
  selling_price: number | null
  // 'fbs' (seller ships) | 'fbo' / 'fby' (marketplace warehouse) | null (unknown)
  fulfillment_type: string | null
  // Variant grouping (Phases 1/1.5): parent key + resolved colour key, per member.
  variant_group_key: string | null
  variant_color: string | null
}

export interface StockGroup {
  match_key: string
  title: string
  members: StockGroupMember[]
  /** marketplace → current marketplace-reported stock */
  stock_by_marketplace: Partial<Record<MarketplaceType, number>>
  /** marketplace → exact units sold (from synced orders) */
  sold_by_marketplace: Partial<Record<MarketplaceType, number>>
  total_stock_api: number
  total_sold: number
  /** units on cancelled/returned orders — visible, but never counted as sold */
  total_cancelled: number
  /** units on open orders (pending/confirmed) — ordered, not yet delivered */
  total_in_process: number
  /** user-entered physical quantity, null = api mode */
  total_physical_stock: number | null
  baseline_at: string | null
  stock_threshold: number | null
  sold_since_baseline: number
  mode: 'api' | 'baseline'
  /** total units left across all marketplaces */
  leftover: number
  /** units sold in the last 14 days (all marketplaces) */
  sold_14d: number
  /** leftover / daily velocity; null when no recent sales */
  days_of_stock: number | null
  /** match_keys that were manually merged into this group */
  merged_from: string[]
  /**
   * Variant-parent key (Phase 3). The canonical key of this group's product
   * parent — the connected component of StockGroups linked by sharing any member
   * variant_group_key on any marketplace (so a same-SKU product listed on both
   * marketplaces still nests). Null when the group has no variant key at all.
   * StockGroups sharing this value render under one collapsible parent (2+).
   */
  variant_group_key: string | null
  /** Resolved colour key of this variant (first non-null member), for the child label. */
  variant_color: string | null
}

// The canonical cross-marketplace grouping key. Exported so the product-group
// suggester writes/reads the exact same key `computeStockGroups` groups by.
export function normalizeKey(sku: string): string {
  return sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
}

/** Session-scoped variant for dashboard pages and API routes. */
export async function getStockGroups(): Promise<StockGroup[]> {
  const [userId, shopIds] = await Promise.all([getCurrentUserId(), getShopIds()])
  if (!userId || !shopIds || shopIds.length === 0) return []
  return computeStockGroups(userId, shopIds)
}

/** Core aggregation — usable from cron jobs where there is no session. */
export async function computeStockGroups(userId: string, shopIds: string[]): Promise<StockGroup[]> {
  if (shopIds.length === 0) return []

  const since14d = new Date()
  since14d.setDate(since14d.getDate() - 14)
  // Pinned once per query: every group in one response must be measured
  // against the same cutoff.
  const now = new Date()

  const [productRows, shopRows, soldRows, sold14Rows, linkRows, cancelledRows, inProcessRows, mergeRows] = await Promise.all([
    db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      title: products.title,
      selling_price: products.selling_price,
      stock_quantity: products.stock_quantity,
      fulfillment_type: products.fulfillment_type,
      variant_group_key: products.variant_group_key,
      variant_color: products.variant_color,
      // Остатки never shows archived listings — they aren't sellable stock.
    }).from(products).where(and(inArray(products.shop_id, shopIds), eq(products.is_archived, false))),
    db.select({ id: shops.id, marketplace: shops.marketplace })
      .from(shops).where(inArray(shops.id, shopIds)),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        notInArray(orders.status, [...NOT_SOLD_STATUSES]),
      ))
      .groupBy(orderItems.product_id),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        notInArray(orders.status, [...NOT_SOLD_STATUSES]),
        gte(orders.ordered_at, since14d),
      ))
      .groupBy(orderItems.product_id),
    db.select().from(productLinks).where(eq(productLinks.user_id, userId)),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        inArray(orders.status, [...NOT_SOLD_STATUSES]),
      ))
      .groupBy(orderItems.product_id),
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        // Same reserved definition the Products page and the stock engine use
        // — see lib/marketplace/reserved-display.ts. This feeds `leftover`
        // below, so a divergence here would put the two pages' stock numbers
        // out of step with each other.
        displayReservedCondition(now),
      ))
      .groupBy(orderItems.product_id),
    db.select({ source_key: productGroupMerges.source_key, target_key: productGroupMerges.target_key })
      .from(productGroupMerges).where(eq(productGroupMerges.user_id, userId)),
  ])

  const mpByShop = new Map(shopRows.map(s => [s.id, s.marketplace as MarketplaceType]))
  const soldByProduct = new Map(soldRows.map(r => [r.product_id, Number(r.qty)]))
  const cancelledByProduct = new Map(cancelledRows.map(r => [r.product_id, Number(r.qty)]))
  const inProcessByProduct = new Map(inProcessRows.map(r => [r.product_id, Number(r.qty)]))
  const sold14ByProduct = new Map(sold14Rows.map(r => [r.product_id, Number(r.qty)]))
  const linkByKey = new Map(linkRows.map(l => [l.match_key, l]))

  // Build merge resolution map (source → final target, resolving chains).
  const mergeMap = new Map<string, string>()
  for (const m of mergeRows) mergeMap.set(m.source_key, m.target_key)
  function resolveKey(key: string): string {
    const seen = new Set<string>()
    let k = key
    while (mergeMap.has(k) && !seen.has(k)) {
      seen.add(k)
      k = mergeMap.get(k)!
    }
    return k
  }

  // Group products by normalized SKU; products without a SKU stand alone.
  const groups = new Map<string, StockGroupMember[]>()
  for (const p of productRows) {
    const rawKey = p.sku ? normalizeKey(p.sku) : `#${p.id}`
    const key = resolveKey(rawKey)
    const member: StockGroupMember = {
      product_id: p.id,
      marketplace: mpByShop.get(p.shop_id) ?? 'uzum',
      title: p.title,
      sku: p.sku,
      stock: p.stock_quantity,
      sold_total: soldByProduct.get(p.id) ?? 0,
      selling_price: p.selling_price ? Number(p.selling_price) : null,
      fulfillment_type: p.fulfillment_type,
      variant_group_key: p.variant_group_key,
      variant_color: p.variant_color,
    }
    const list = groups.get(key)
    if (list) list.push(member)
    else groups.set(key, [member])
  }

  // Exact sold-since-baseline counts, one grouped query for all baselines.
  // Each group can have its own baseline date, so we take the per-product
  // sold sums since the OLDEST baseline bucketed by day and filter in JS.
  const baselineKeys = [...linkByKey.values()].filter(l =>
    l.total_physical_stock != null && l.baseline_at != null && groups.has(l.match_key))
  const soldSinceBaseline = new Map<string, number>() // match_key → qty
  if (baselineKeys.length > 0) {
    const oldest = new Date(Math.min(...baselineKeys.map(l => l.baseline_at!.getTime())))
    const memberIds = baselineKeys.flatMap(l => groups.get(l.match_key)!.map(m => m.product_id))
    const productToKey = new Map<string, string>()
    for (const l of baselineKeys) {
      for (const m of groups.get(l.match_key)!) productToKey.set(m.product_id, l.match_key)
    }
    const rows = await db.select({
      product_id: orderItems.product_id,
      day: sql<string>`date_trunc('day', ${orders.ordered_at})`.as('day'),
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        notInArray(orders.status, [...NOT_SOLD_STATUSES]),
        gte(orders.ordered_at, oldest),
        inArray(orderItems.product_id, memberIds),
      ))
      .groupBy(orderItems.product_id, sql`date_trunc('day', ${orders.ordered_at})`)

    for (const r of rows) {
      if (!r.product_id) continue
      const key = productToKey.get(r.product_id)
      if (!key) continue
      const link = linkByKey.get(key)!
      if (new Date(r.day).getTime() >= new Date(link.baseline_at!).setUTCHours(0, 0, 0, 0)) {
        soldSinceBaseline.set(key, (soldSinceBaseline.get(key) ?? 0) + Number(r.qty))
      }
    }
  }

  // Build reverse map: target_key → [source_keys that merged into it]
  const mergedFromMap = new Map<string, string[]>()
  for (const m of mergeRows) {
    const target = resolveKey(m.target_key)
    const list = mergedFromMap.get(target)
    if (list) list.push(m.source_key)
    else mergedFromMap.set(target, [m.source_key])
  }

  const result: StockGroup[] = []
  for (const [key, members] of groups) {
    const link = linkByKey.get(key)

    const stockByMp: Partial<Record<MarketplaceType, number>> = {}
    const soldByMp: Partial<Record<MarketplaceType, number>> = {}
    let totalSold = 0
    let totalCancelled = 0
    let totalInProcess = 0
    let sold14 = 0
    for (const m of members) {
      stockByMp[m.marketplace] = (stockByMp[m.marketplace] ?? 0) + m.stock
      soldByMp[m.marketplace] = (soldByMp[m.marketplace] ?? 0) + m.sold_total
      totalSold += m.sold_total
      totalCancelled += cancelledByProduct.get(m.product_id) ?? 0
      totalInProcess += inProcessByProduct.get(m.product_id) ?? 0
      sold14 += sold14ByProduct.get(m.product_id) ?? 0
    }

    // FBS/FBO-aware physical stock. Members are bucketed by fulfillment_type:
    //   FBO/FBY → each marketplace holds independent inventory → SUM them.
    //   FBS / unknown → same physical pool listed on every marketplace as
    //     "N available" → take the MAX to avoid double-counting.
    // Total leftover = FBO sum + FBS max. Unknown defaults to FBS because
    // undercounting a real number is safer than inventing units that aren't
    // there (which would let sellers oversell).
    const fboMembers = members.filter(m =>
      m.fulfillment_type === 'fbo' || m.fulfillment_type === 'fby')
    const fbsMembers = members.filter(m =>
      m.fulfillment_type !== 'fbo' && m.fulfillment_type !== 'fby')
    const fboStock = fboMembers.reduce((sum, m) => sum + m.stock, 0)
    const fbsStock = fbsMembers.length > 0
      ? Math.max(0, ...fbsMembers.map(m => m.stock))
      : 0
    const totalStock = fboStock + fbsStock

    const hasBaseline = link?.total_physical_stock != null && link.baseline_at != null
    const sinceBaseline = soldSinceBaseline.get(key) ?? 0
    // API mode: stock_quantity from the marketplace API already reflects
    // completed sales. Only subtract pending/confirmed orders (in-process)
    // that the API may not have accounted for yet. Baseline mode keeps its
    // own running tally of sold-since-baseline.
    const leftover = hasBaseline
      ? Math.max(0, link!.total_physical_stock! - sinceBaseline)
      : Math.max(0, totalStock - totalInProcess)

    // variant_group_key is resolved AFTER the loop by union-find (Phase 3): a
    // product parent is the transitive closure of StockGroups sharing any member
    // variant_group_key on any marketplace. Set to null here as a placeholder.
    const variantColor = members.find(m => m.variant_color != null)?.variant_color ?? null

    const dailyVelocity = sold14 / 14
    result.push({
      match_key: key,
      title: members[0].title,
      members,
      stock_by_marketplace: stockByMp,
      sold_by_marketplace: soldByMp,
      total_stock_api: totalStock,
      total_sold: totalSold,
      total_cancelled: totalCancelled,
      total_in_process: totalInProcess,
      total_physical_stock: link?.total_physical_stock ?? null,
      baseline_at: link?.baseline_at?.toISOString() ?? null,
      stock_threshold: link?.stock_threshold ?? null,
      sold_since_baseline: sinceBaseline,
      mode: hasBaseline ? 'baseline' : 'api',
      leftover,
      sold_14d: sold14,
      days_of_stock: dailyVelocity > 0 ? Math.floor(leftover / dailyVelocity) : null,
      merged_from: mergedFromMap.get(key) ?? [],
      variant_group_key: null,
      variant_color: variantColor,
    })
  }

  // ── Phase 3: cross-marketplace variant parents ─────────────────────────────
  // Phase 2 grouped by a single per-SKU key, so a product listed on BOTH
  // marketplaces (its StockGroup carries e.g. uzum:… AND yandex:… keys) fell to
  // a flat row. Union StockGroups into product parents by the transitive closure
  // of "shares any member variant_group_key on any marketplace": the two merged
  // JMWHT / JMBLK groups both hold uzum:3135544 → one M9 parent, even though each
  // also spans Yandex. J16 (different SKU codes per marketplace) shares no key
  // across marketplaces, so it stays split — the SKU codes decide, no special case.
  const uf = new Map<number, number>()
  result.forEach((_, i) => uf.set(i, i))
  const find = (x: number): number => { let r = x; while (uf.get(r)! !== r) r = uf.get(r)!; return r }
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) uf.set(ra, rb) }
  // Link every pair of StockGroups that share a variant_group_key.
  const keyToIdx = new Map<string, number[]>()
  result.forEach((g, i) => {
    for (const k of new Set(g.members.map(m => m.variant_group_key).filter((k): k is string => k != null))) {
      const list = keyToIdx.get(k)
      if (list) list.push(i); else keyToIdx.set(k, [i])
    }
  })
  for (const idxs of keyToIdx.values()) for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j])
  // Canonical parent key per component = the smallest member key in the whole
  // component (stable + shared by every group in it); null when it has no keys.
  const compKeys = new Map<number, string[]>()
  result.forEach((g, i) => {
    const root = find(i)
    const acc = compKeys.get(root) ?? []
    for (const m of g.members) if (m.variant_group_key) acc.push(m.variant_group_key)
    compKeys.set(root, acc)
  })
  result.forEach((g, i) => {
    const keys = compKeys.get(find(i))!
    g.variant_group_key = keys.length ? [...keys].sort()[0] : null
  })

  // Lowest leftover first — the products that need attention float to the top.
  result.sort((a, b) => a.leftover - b.leftover || b.total_sold - a.total_sold)
  return result
}

/** Groups at or below their alert threshold (per-group, else the given default). */
export function lowStockGroups(all: StockGroup[], defaultThreshold: number): StockGroup[] {
  return all.filter(g => g.leftover <= (g.stock_threshold ?? defaultThreshold))
}
