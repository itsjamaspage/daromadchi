/**
 * Stock-sync orchestrator — the dual update.
 *
 *  Step A  recompute the shared available = max(0, MAX(stock across the group)
 *          − SUM(all pending across the group)) and refresh the display.
 *          Every group (read-only included) gets Step A.
 *  Step B  for each stock_sync store whose LISTED number differs from its target
 *          (per oversell_mode), push the new ostatok through the audited writer.
 *          Read-only stores never get Step B.
 *
 * Writes are stamped with a monotonic version and a single computed-at timestamp
 * (stable across retries). Nothing here bypasses lib/marketplace/stock-writer.ts.
 */

import { revalidateTag } from 'next/cache'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, stockSyncState } from '@/lib/db'
import { logger } from '@/lib/logger'
import { pushStock, type StockWriteStatus } from '@/lib/marketplace/stock-writer'
import { planStockWrites, type SyncMember, type OversellMode } from '@/lib/marketplace/stock-allocation'
import { decrypt } from '@/lib/crypto'
import { fetchAllUzumSkuStocks } from '@/lib/uzum/client'
import { fetchYandexStockLocations } from '@/lib/yandex/client'
import type { MarketplaceType } from '@/lib/types'

const IN_SCOPE: MarketplaceType[] = ['uzum', 'yandex_market']

function normalizeKey(sku: string): string {
  return sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
}

interface ShopRow {
  id: string
  marketplace: MarketplaceType
  api_mode: 'read_only' | 'stock_sync'
  stock_sync_dry_run: boolean
  oversell_mode: OversellMode
  primary_channel_priority: number
  shop_id_external: string | null
  api_key_encrypted: string | null
}

interface ProductRow {
  id: string
  shop_id: string
  sku: string | null
  stock_quantity: number
  market_barcode: string | null
  market_sku: string | null
  market_warehouse_id: string | null
}

export interface StockSyncLogEntry {
  matchKey: string
  marketplace: MarketplaceType
  shopId: string
  productId: string
  available: number
  listed: number
  target: number
  dryRun: boolean
  version: number
  status: StockWriteStatus
  reason?: string
}

export interface StockSyncRunResult {
  computedAt: string
  groupsConsidered: number
  writesPlanned: number
  entries: StockSyncLogEntry[]
}

interface RunOptions {
  userId: string
  /** Force every write to dry-run regardless of the shop's flag (YM-webhook path). */
  forceDryRun?: boolean
  /** Restrict to a single normalized match key (first-live / targeted runs). */
  onlyMatchKey?: string
}

async function loadGroups(userId: string): Promise<{
  shopsById: Map<string, ShopRow>
  groups: Map<string, { members: SyncMember[]; products: Map<string, ProductRow> }>
}> {
  const shopRows = (await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_mode: shops.api_mode,
    stock_sync_dry_run: shops.stock_sync_dry_run,
    oversell_mode: shops.oversell_mode,
    primary_channel_priority: shops.primary_channel_priority,
    shop_id_external: shops.shop_id_external,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops).where(and(eq(shops.user_id, userId), eq(shops.is_active, true)))) as ShopRow[]

  const shopsById = new Map(shopRows.filter(s => IN_SCOPE.includes(s.marketplace)).map(s => [s.id, s]))
  const shopIds = [...shopsById.keys()]
  const groups = new Map<string, { members: SyncMember[]; products: Map<string, ProductRow> }>()
  if (shopIds.length === 0) return { shopsById, groups }

  const [prodRows, pendingRows] = await Promise.all([
    db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      stock_quantity: products.stock_quantity,
      market_barcode: products.market_barcode,
      market_sku: products.market_sku,
      market_warehouse_id: products.market_warehouse_id,
    }).from(products).where(inArray(products.shop_id, shopIds)) as Promise<ProductRow[]>,
    db.select({
      product_id: orderItems.product_id,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(inArray(orders.shop_id, shopIds), inArray(orders.status, ['pending', 'confirmed'])))
      .groupBy(orderItems.product_id),
  ])

  const pendingByProduct = new Map(pendingRows.map(r => [r.product_id, Number(r.qty)]))

  for (const p of prodRows) {
    const shop = shopsById.get(p.shop_id)
    if (!shop) continue
    const key = p.sku ? normalizeKey(p.sku) : `#${p.id}`
    let g = groups.get(key)
    if (!g) { g = { members: [], products: new Map() }; groups.set(key, g) }
    g.products.set(p.id, p)
    g.members.push({
      productId: p.id,
      shopId: p.shop_id,
      marketplace: shop.marketplace,
      apiMode: shop.api_mode,
      priority: shop.primary_channel_priority,
      listedStock: p.stock_quantity,
      pending: pendingByProduct.get(p.id) ?? 0,
      sku: p.sku,
    })
  }
  return { shopsById, groups }
}

// Bump and return the monotonic version for (shop, match-key), recording the
// last decision. Called once per real write, before pushing.
async function bumpVersion(shopId: string, matchKey: string, productId: string, available: number, target: number): Promise<number> {
  const [existing] = await db.select({ version: stockSyncState.version })
    .from(stockSyncState).where(and(eq(stockSyncState.shop_id, shopId), eq(stockSyncState.sku, matchKey)))
  const newVersion = (existing?.version ?? 0) + 1
  const now = new Date()
  await db.insert(stockSyncState).values({
    shop_id: shopId, product_id: productId, sku: matchKey, version: newVersion,
    last_available: available, last_target: target, last_pushed_at: now, updated_at: now,
  }).onConflictDoUpdate({
    target: [stockSyncState.shop_id, stockSyncState.sku],
    set: { version: newVersion, product_id: productId, last_available: available, last_target: target, last_pushed_at: now, updated_at: now },
  })
  return newVersion
}

/**
 * Run Step A + Step B for every SKU group that has at least one stock_sync
 * member. Returns a log of every planned write (the dry-run log when shops are
 * in test mode).
 */
export async function syncStockSyncGroups(opts: RunOptions): Promise<StockSyncRunResult> {
  const computedAt = new Date().toISOString()
  const { shopsById, groups } = await loadGroups(opts.userId)
  const entries: StockSyncLogEntry[] = []
  let groupsConsidered = 0
  let writesPlanned = 0
  let anyDisplayChange = false

  for (const [matchKey, group] of groups) {
    if (opts.onlyMatchKey && matchKey !== opts.onlyMatchKey) continue
    const writableMembers = group.members.filter(m => m.apiMode === 'stock_sync')
    if (writableMembers.length === 0) continue // Step A only (display), no writes
    groupsConsidered++

    // Oversell policy comes from the primary (lowest-priority) stock_sync shop.
    const primary = [...writableMembers].sort((a, b) => a.priority - b.priority)[0]
    const oversellMode = shopsById.get(primary.shopId)?.oversell_mode ?? 'lock_last_unit'

    const { available, plans } = planStockWrites(group.members, oversellMode)
    anyDisplayChange = true // available may have moved; refresh the display

    for (const plan of plans) {
      if (!plan.willWrite) continue // real diff only
      writesPlanned++
      const shop = shopsById.get(plan.member.shopId)!
      const product = group.products.get(plan.member.productId)!
      const dryRun = shop.stock_sync_dry_run || !!opts.forceDryRun

      // Resolve the write identifier just before pushing.
      const barcode = shop.marketplace === 'uzum' ? product.market_barcode : null
      const marketSku = shop.marketplace === 'yandex_market' ? product.market_sku : product.sku
      const warehouseId = shop.marketplace === 'yandex_market' ? product.market_warehouse_id : null

      const version = await bumpVersion(shop.id, matchKey, product.id, available, plan.target)
      const result = await pushStock({
        shop: {
          id: shop.id,
          marketplace: shop.marketplace,
          api_key_encrypted: shop.api_key_encrypted,
          shop_id_external: shop.shop_id_external,
          api_mode: shop.api_mode,
        },
        sku: marketSku,
        barcode,
        quantity: plan.target,
        dryRun,
        version,
        warehouseId,
        productId: product.id,
        updatedAt: computedAt,
      })

      entries.push({
        matchKey, marketplace: shop.marketplace, shopId: shop.id, productId: product.id,
        available, listed: plan.member.listedStock, target: plan.target, dryRun, version,
        status: result.status, reason: result.reason,
      })
    }
  }

  // Step A: refresh the display so the recomputed available shows immediately.
  if (anyDisplayChange) {
    revalidateTag('product-data', { expire: 0 })
    revalidateTag('order-data', { expire: 0 })
  }

  logger.info('stock_sync_run', {
    userId: opts.userId, computedAt, groupsConsidered, writesPlanned,
    dryRunAll: entries.length > 0 && entries.every(e => e.dryRun),
  })
  return { computedAt, groupsConsidered, writesPlanned, entries }
}

// ─── Read-back verification (first live push) ─────────────────────────────────
// After a live write, re-read the SKU from the store and confirm the number
// actually changed — a silent 200 that didn't move the value (wrong barcode /
// warehouse / stale timestamp) is the failure mode that looks like success.
export async function readBackStock(
  shop: { marketplace: MarketplaceType; api_key_encrypted: string | null; shop_id_external?: string | null },
  identifier: string,
): Promise<number | null> {
  if (!shop.api_key_encrypted) return null
  const token = decrypt(shop.api_key_encrypted)
  try {
    if (shop.marketplace === 'uzum') {
      const stocks = await fetchAllUzumSkuStocks(token)
      const rec = stocks.find(s => String(s.barcode ?? '').trim() === identifier.trim())
      if (!rec) return null
      const n = rec.amount ?? rec.quantityActive
      return typeof n === 'number' ? n : null
    }
    if (shop.marketplace === 'yandex_market') {
      const campaignId = shop.shop_id_external?.trim()
      if (!campaignId) return null
      const locations = await fetchYandexStockLocations(token, campaignId)
      return locations.get(identifier.trim())?.count ?? null
    }
  } catch (err) {
    logger.warn('stock_read_back_failed', { marketplace: shop.marketplace, error: String(err).slice(0, 200) })
  }
  return null
}

export interface FirstLiveResult {
  productId: string
  status: StockWriteStatus
  target: number
  pushed: boolean
  observed: number | null
  verified: boolean
  reason?: string
}

/**
 * The controlled first live write: one hand-picked product, pushed LIVE, then
 * read back to prove the marketplace actually shows the new number.
 */
export async function firstLivePush(userId: string, productId: string): Promise<FirstLiveResult> {
  const fail = (reason: string, target = 0): FirstLiveResult =>
    ({ productId, status: 'skipped', target, pushed: false, observed: null, verified: false, reason })

  const { shopsById, groups } = await loadGroups(userId)

  // Find the product's group + member.
  let found: { matchKey: string; member: SyncMember; product: ProductRow; available: number; target: number } | null = null
  for (const [matchKey, group] of groups) {
    const product = group.products.get(productId)
    if (!product) continue
    const oversellMode = shopsById.get(product.shop_id)?.oversell_mode ?? 'lock_last_unit'
    const { available, plans } = planStockWrites(group.members, oversellMode)
    const plan = plans.find(p => p.member.productId === productId)
    if (!plan) return fail('product_not_stock_sync')
    found = { matchKey, member: plan.member, product, available, target: plan.target }
    break
  }
  if (!found) return fail('product_not_found')

  const shop = shopsById.get(found.product.shop_id)
  if (!shop) return fail('shop_not_found', found.target)
  if (shop.api_mode !== 'stock_sync') return fail('shop_read_only', found.target)

  const barcode = shop.marketplace === 'uzum' ? found.product.market_barcode : null
  const marketSku = shop.marketplace === 'yandex_market' ? found.product.market_sku : found.product.sku
  const warehouseId = shop.marketplace === 'yandex_market' ? found.product.market_warehouse_id : null
  const identifier = shop.marketplace === 'uzum' ? barcode : marketSku
  if (!identifier) return fail('missing_identifier', found.target)

  const version = await bumpVersion(shop.id, found.matchKey, found.product.id, found.available, found.target)
  const result = await pushStock({
    shop: {
      id: shop.id, marketplace: shop.marketplace, api_key_encrypted: shop.api_key_encrypted,
      shop_id_external: shop.shop_id_external, api_mode: shop.api_mode,
    },
    sku: marketSku, barcode, quantity: found.target, dryRun: false, version, warehouseId,
    productId: found.product.id, updatedAt: new Date().toISOString(),
  })

  if (result.status !== 'sent') {
    return { productId, status: result.status, target: found.target, pushed: false, observed: null, verified: false, reason: result.reason }
  }

  const observed = await readBackStock(shop, identifier)
  const verified = observed === found.target
  logger.info('first_live_read_back', { productId, marketplace: shop.marketplace, target: found.target, observed, verified })
  return { productId, status: 'sent', target: found.target, pushed: true, observed, verified }
}
