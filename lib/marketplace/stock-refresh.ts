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
import { uzumStockQuantity } from '@/lib/uzum/stock-reading'
import { logger } from '@/lib/logger'

export interface StockRefreshResult {
  ok: boolean
  /** SKUs the marketplace reported. */
  seen: number
  /** Rows whose stored quantity actually changed. */
  updated: number
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
