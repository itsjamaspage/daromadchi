/**
 * The cheap stock-only refresh: re-read live quantities and nothing else.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Orders poll every 5 minutes, but stock only moved on the plan-gated heavy
 * pass — up to 2h on pro, 6h on free. A seller who restocked on the marketplace
 * saw a stale number for hours and reasonably concluded the app does not update
 * itself. This is the same decouple PR #155 did for orders: the expensive work
 * stays throttled, the cheap read that sellers actually notice runs often.
 *
 * ── Why the CARD endpoint and not /v3/fbs/sku/stocks ────────────────────────
 * The stock-only endpoint sounds like the obvious choice and is the wrong one.
 * Its DTO carries `amount` and `quantityActive` but NO `quantityFbs`, because
 * it reports FBS stock. The card endpoint reports quantityActive + quantityFbs.
 * Refreshing from the FBS feed would therefore overwrite a correct combined
 * figure with an FBS-only one for any shop holding FBO stock — silently
 * lowering it, the same harm as the RUN_OUT freeze in the other direction.
 * The card endpoint costs one or two paged calls at this size, returns the DTO
 * the heavy pass already parses, and inherits uzumStockQuantity unchanged.
 *
 * ── The one rule ────────────────────────────────────────────────────────────
 * A SKU absent from the response is UNKNOWN, never zero. Only SKUs the response
 * actually carried are written. Treating absence as "sold out" is how a paging
 * hiccup would zero a seller's whole catalogue in a single tick.
 */
import 'server-only'
import { eq, inArray } from 'drizzle-orm'
import { db, products } from '@/lib/db'
import { fetchUzumShopProducts, fetchUzumShops, getUzumRateLimit, UzumApiError } from '@/lib/uzum/client'
import { fetchAllYandexStocks } from '@/lib/yandex/client'
import { uzumStockQuantity } from '@/lib/uzum/stock-reading'
import { stockKeysFor, trimmedIndex, resolveStock } from '@/lib/marketplace/stock-key-match'
import { logger } from '@/lib/logger'

export interface StockRefreshResult {
  ok: boolean
  /** SKUs the marketplace reported. */
  seen: number
  /** Rows whose stored quantity actually changed. */
  updated: number
  /**
   * Rows we track that the response said NOTHING about, after trying every
   * identifier. Each one keeps its old quantity — safe, but invisible until
   * now: a refresh can report `ok` with `updated: 0` either because the
   * catalogue genuinely did not move or because it matched nothing at all, and
   * those are very different. This is what tells them apart.
   */
  unmatched?: number
  error?: string
}

/** Page cap — a safety backstop, not the expected path. */
const MAX_PAGES = 20
const PAGE_SIZE = 100

/**
 * Refresh one Uzum shop's stock quantities.
 *
 * `uzumShopIds` is passed by the caller when it already knows them (the cron
 * has shop_id_external cached), so the common path spends no call resolving
 * what we already store.
 */
export async function refreshUzumStock(
  shopId: string,
  token: string,
  cachedUzumShopId?: string | null,
): Promise<StockRefreshResult> {
  let uzumShopIds: number[] = []
  if (cachedUzumShopId && /^\d+$/.test(cachedUzumShopId)) {
    uzumShopIds = [Number(cachedUzumShopId)]
  } else {
    try {
      uzumShopIds = (await fetchUzumShops(token))
        .map(s => s.id)
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    } catch (e) {
      return { ok: false, seen: 0, updated: 0, error: `resolve shops: ${String(e).slice(0, 200)}` }
    }
  }
  if (uzumShopIds.length === 0) return { ok: false, seen: 0, updated: 0, error: 'no uzum shop id' }

  // marketplace_product_id → live quantity. Keyed on skuId, which is what the
  // product sync writes, so this join has no ambiguity to get wrong.
  const live = new Map<string, number>()
  try {
    for (const uShopId of uzumShopIds) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await fetchUzumShopProducts(token, uShopId, page, PAGE_SIZE)
        const list = res.productList ?? []
        for (const card of list) {
          for (const sku of card.skuList ?? []) {
            if (sku.skuId == null) continue
            live.set(String(sku.skuId), uzumStockQuantity(sku))
          }
        }
        const total = res.totalProductsAmount ?? 0
        if (list.length < PAGE_SIZE || (page + 1) * PAGE_SIZE >= total) break
      }
    }
  } catch (e) {
    const msg = e instanceof UzumApiError ? `HTTP ${e.status}` : String(e).slice(0, 200)
    // A partial read is not a reason to write partial data — bail without
    // touching anything rather than half-refreshing from a broken page.
    return { ok: false, seen: live.size, updated: 0, error: msg }
  }
  if (live.size === 0) return { ok: true, seen: 0, updated: 0 }

  // Compare before writing so `updated` counts real movement, and so an
  // unchanged catalogue costs zero UPDATEs.
  const ids = [...live.keys()]
  const rows = await db.select({
    id: products.id, mpid: products.marketplace_product_id, stock: products.stock_quantity,
  }).from(products).where(inArray(products.marketplace_product_id, ids))

  let updated = 0
  for (const r of rows) {
    const next = live.get(String(r.mpid))
    if (next === undefined || next === r.stock) continue
    await db.update(products).set({ stock_quantity: next }).where(eq(products.id, r.id))
    updated++
  }

  const rl = getUzumRateLimit()
  logger.info('uzum_stock_refresh', {
    shopId, seen: live.size, updated,
    // Real headroom, read off the response we already made rather than
    // estimated from the schedule.
    rateLimitRemainingPerDay: rl?.remainingPerDay ?? null,
    rateLimitPerDay: rl?.limitPerDay ?? null,
  })
  return { ok: true, seen: live.size, updated }
}

/**
 * Refresh one Yandex shop's stock quantities.
 *
 * ── The join ────────────────────────────────────────────────────────────────
 * The stocks response is keyed by offerId — the seller's own code — which is
 * normally what products.sku holds, and a live probe against the real account
 * confirmed that: 8 catalog entries, 8 stock keys, every SKU hitting on
 * shopSku with the expected FIT count.
 *
 * That probe is why this used to look up products.sku and nothing else. It was
 * a point-in-time check of one account, and it does not hold for every row.
 * When offer-mappings returns an entry with no shopSku/offerId, `skuOf()`
 * yields '' and the product is stored with `sku = marketSku`
 * (lib/yandex/sync.ts:334) — which never appears as a stocks key. Such a row
 * missed here forever while the heavy pass still refreshed it through its own
 * fallback chain (lib/yandex/sync.ts:301-305), so its stock moved only on the
 * plan-gated pass. Exactly the staleness this whole module exists to remove.
 *
 * So the lookup now tries every identifier the row carries, via
 * resolveStock() — market_sku first (it is defined as the exact shopSku these
 * endpoints expect), then sku, then marketplace_product_id. What we are
 * willing to WRITE is unchanged; only what we can find widened.
 *
 * ── Partial reads ───────────────────────────────────────────────────────────
 * Yandex pages sequentially, so a mid-page failure stops a batch early with a
 * partly-filled map. That is now visible (`complete`), and it matters here
 * because absence means "unknown" — on a truncated read the untouched SKUs
 * silently keep their old values, which is safe but worth logging rather than
 * reporting as a clean refresh. `unmatched` in the log line separates the two
 * causes of a quiet tick: a complete read with unmatched > 0 is an identifier
 * mismatch, not a lost page.
 */
export async function refreshYandexStock(
  shopId: string,
  token: string,
  campaignId: string,
): Promise<StockRefreshResult> {
  // Ask for the SKUs we actually track. The endpoint ignores the list when the
  // empty-body attempt wins and returns the whole catalogue paginated, which is
  // harmless — we only read keys we have rows for.
  const own = await db.select({
    id: products.id,
    sku: products.sku,
    market_sku: products.market_sku,
    marketplace_product_id: products.marketplace_product_id,
    stock: products.stock_quantity,
  }).from(products).where(eq(products.shop_id, shopId))
  // Ask under every identifier we hold, not just products.sku — a row stored
  // with a marketSku (offer-mappings returned no shopSku) would otherwise never
  // appear in the request OR the response.
  const skus = [...new Set(own.flatMap(stockKeysFor))]
  if (skus.length === 0) return { ok: true, seen: 0, updated: 0 }

  let stockMap: Map<string, number>
  let complete: boolean
  let lastError: string | null
  try {
    const r = await fetchAllYandexStocks(token, campaignId, skus)
    stockMap = r.stockMap; complete = r.complete; lastError = r.lastError
  } catch (e) {
    return { ok: false, seen: 0, updated: 0, error: String(e).slice(0, 200) }
  }
  // Nothing readable at all is a failed refresh, not an empty catalogue — the
  // stock clock must stay due so the next tick retries.
  if (stockMap.size === 0) {
    return { ok: false, seen: 0, updated: 0, error: lastError ?? 'stocks response empty' }
  }

  const trimmed = trimmedIndex(stockMap)
  let updated = 0
  let unmatched = 0
  for (const p of own) {
    // Same identifier chain the heavy pass resolves through, so a product the
    // heavy pass can refresh is never one the light pass silently skips.
    const next = resolveStock(p, stockMap, trimmed)
    // Absent = UNKNOWN. Never written, never zeroed.
    if (next === undefined) { unmatched++; continue }
    if (next === p.stock) continue
    await db.update(products).set({ stock_quantity: next }).where(eq(products.id, p.id))
    updated++
  }

  logger.info('yandex_stock_refresh', {
    shopId, seen: stockMap.size, updated, complete,
    // Tracked rows the response never mentioned. Non-zero on a `complete` read
    // means an identifier mismatch, not a truncated page — worth looking at.
    unmatched, tracked: own.length,
    ...(lastError ? { lastError } : {}),
  })
  return { ok: true, seen: stockMap.size, updated, unmatched }
}
