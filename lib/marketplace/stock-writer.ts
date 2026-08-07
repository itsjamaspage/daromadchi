/**
 * THE single module through which any marketplace stock write may happen.
 * (HARD RULE #2 — all marketplace writes go through here and nowhere else.)
 *
 * `pushStock` updates ONE thing: the stock quantity (ostatok) of one SKU on one
 * shop's live listing. Never price, title, order status, invoices, or anything
 * else. Every attempt is:
 *   • kill-switch checked  (STOCK_SYNC_KILL_SWITCH disables all writes instantly)
 *   • restricted to stock_sync shops on Uzum / Yandex Market only
 *   • hard-skipped when the write identifier is missing/blank (never guess)
 *   • clamped to Math.max(0, quantity)
 *   • routed through the shared marketplaceFetch guard with intent 'stock-write',
 *     which only lets the exact stock endpoint through
 *   • audited in stock_write_log (sent | skipped | blocked | killed | error)
 *
 * Writes are ALWAYS LIVE and automatic — there is no dry-run gate and no env
 * flag that disables writing. Transparency comes from the audit log + the
 * seller notification, not from a pre-write simulation.
 */

import { and, eq } from 'drizzle-orm'
import { db, stockWriteLog, stockSyncState } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { marketplaceFetch, type MarketplaceInit } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { YANDEX_API_BASE } from '@/lib/yandex/client'
import type { MarketplaceType } from '@/lib/types'

export type StockWriteStatus = 'sent' | 'skipped' | 'blocked' | 'killed' | 'error'

export interface StockWriteShop {
  id: string
  marketplace: MarketplaceType
  api_key_encrypted: string | null
  // Yandex Market: the campaignId the stock-update PUT is scoped to.
  shop_id_external?: string | null
  // read_only shops are NEVER written to. Undefined is treated as read_only.
  api_mode?: 'read_only' | 'stock_sync' | null
}

export interface PushStockParams {
  shop: StockWriteShop
  /** Seller article / shopSku — used in the audit log and (for YM) the payload. */
  sku: string | null
  /** Uzum market barcode (STRING, from /v3/fbs/sku/stocks). Required for Uzum. */
  barcode: string | null
  /** Desired quantity. Clamped to Math.max(0, quantity) before anything else. */
  quantity: number
  /** Monotonic freshness version (per shop+sku). Recorded now; enforced in Phase 4. */
  version: number
  /** Yandex Market warehouseId the write targets. Required for YM. */
  warehouseId?: string | null
  /** products.id for the audit-row FK (optional). */
  productId?: string | null
  /**
   * Match-key for the freshness guard. When set, the write is refused if a newer
   * version has already been recorded for this (shop, key) — a stale/out-of-order
   * write can never leapfrog a correct one. Omit to skip the check.
   */
  freshnessKey?: string
  /**
   * ISO timestamp stamped into the YM payload's `updatedAt`. MUST be the moment
   * the quantity was computed, and stable across retries of the same logical
   * write — the caller computes it once alongside `version`. Defaults to now
   * only when a caller omits it (single, non-retried writes).
   */
  updatedAt?: string
}

export interface PushStockResult {
  status: StockWriteStatus
  reason?: string
  /** Clamped quantity that was written / simulated. */
  quantity: number
  httpStatus?: number
  logId?: string
}

const KILL_SWITCH_VALUES = new Set(['1', 'true', 'yes', 'on'])

function killSwitchOn(): boolean {
  const v = (process.env.STOCK_SYNC_KILL_SWITCH ?? '').trim().toLowerCase()
  return KILL_SWITCH_VALUES.has(v)
}

interface AuditFields {
  shop_id: string
  product_id?: string | null
  marketplace: MarketplaceType
  sku?: string | null
  identifier?: string | null
  warehouse_id?: string | null
  endpoint?: string | null
  method?: string | null
  requested_quantity: number
  quantity: number
  version: number
  dry_run: boolean
  status: StockWriteStatus
  reason?: string | null
  http_status?: number | null
  request_body?: string | null
  response_body?: string | null
  error?: string | null
}

// Never let an audit-write failure crash the caller — record the miss and move on.
async function audit(fields: AuditFields): Promise<string | undefined> {
  try {
    const [row] = await db.insert(stockWriteLog).values({
      shop_id: fields.shop_id,
      product_id: fields.product_id ?? null,
      marketplace: fields.marketplace,
      sku: fields.sku ?? null,
      identifier: fields.identifier ?? null,
      warehouse_id: fields.warehouse_id ?? null,
      endpoint: fields.endpoint ?? null,
      method: fields.method ?? null,
      requested_quantity: fields.requested_quantity,
      quantity: fields.quantity,
      version: fields.version,
      dry_run: fields.dry_run,
      status: fields.status,
      reason: fields.reason ?? null,
      http_status: fields.http_status ?? null,
      request_body: fields.request_body ?? null,
      response_body: fields.response_body ?? null,
      error: fields.error ?? null,
    }).returning({ id: stockWriteLog.id })
    return row?.id
  } catch (err) {
    logger.error('stock_write_log_insert_failed', { shopId: fields.shop_id, error: String(err).slice(0, 300) })
    return undefined
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// Retry with rate-limit-aware backoff. A guard block is NEVER retried (rethrown
// immediately). Honors Retry-After and Uzum's daily cap header: when the daily
// quota is exhausted there's no point retrying, so the response is returned as-is.
async function sendWithRetry(url: string, init: MarketplaceInit, retries = 3): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await marketplaceFetch(url, init)
      const transient = res.status === 429 || res.status >= 500
      const dailyExhausted = res.headers.get('X-RateLimit-Remaining-Per-Day') === '0'
      if (transient && !dailyExhausted && attempt < retries) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 30_000)
          : Math.min(2000 * 2 ** attempt, 30_000)
        await sleep(waitMs)
        continue
      }
      return res
    } catch (err) {
      // A blocked write must fail loud and immediately — never retried.
      if (err instanceof Error && /GUARD/.test(err.message)) throw err
      lastErr = err
      if (attempt < retries) {
        await sleep(Math.min(2000 * 2 ** attempt, 30_000))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/**
 * Push a single SKU's stock quantity to one shop's live listing.
 * Returns the outcome; every path is audited in stock_write_log.
 */
export async function pushStock(params: PushStockParams): Promise<PushStockResult> {
  const { shop, sku, barcode, version, warehouseId, productId } = params
  const marketplace = shop.marketplace
  const requested = params.quantity
  const clamped = Math.max(0, Math.trunc(Number.isFinite(requested) ? requested : 0)) // HARD RULE #6

  const base = {
    shop_id: shop.id,
    product_id: productId,
    marketplace,
    sku,
    version,
    requested_quantity: requested,
    quantity: clamped,
  }

  // 1. Global kill switch — disables ALL writes instantly (HARD RULE #8).
  if (killSwitchOn()) {
    logger.warn('stock_write_kill_switch', { shopId: shop.id, marketplace, sku })
    const logId = await audit({ ...base, dry_run: false, status: 'killed', reason: 'kill_switch' })
    return { status: 'killed', reason: 'kill_switch', quantity: clamped, logId }
  }

  // 2. Read-only shops are NEVER written to (HARD RULE #9).
  if (shop.api_mode !== 'stock_sync') {
    const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'not_stock_sync' })
    return { status: 'skipped', reason: 'not_stock_sync', quantity: clamped, logId }
  }

  // 3. Scope: Uzum + Yandex Market only (no Wildberries).
  if (marketplace !== 'uzum' && marketplace !== 'yandex_market') {
    const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'marketplace_out_of_scope' })
    return { status: 'skipped', reason: 'marketplace_out_of_scope', quantity: clamped, logId }
  }

  // 4. Build the request. Any missing/blank identifier is a HARD SKIP — we never
  //    attempt a write with a null/blank key (would fail silently or hit the
  //    wrong SKU).
  let url: string
  let method: 'POST' | 'PUT'
  let identifier: string
  let whId: string | null = null
  let body: string

  if (marketplace === 'uzum') {
    const bc = barcode?.trim()
    if (!bc) {
      const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'missing_barcode' })
      return { status: 'skipped', reason: 'missing_barcode', quantity: clamped, logId }
    }
    url = `${UZUM_API_BASE}/v2/fbs/sku/stocks`
    method = 'POST'
    identifier = bc
    body = JSON.stringify({ skuAmountList: [{ barcode: bc, amount: clamped, fbsLinked: true }] })
  } else {
    // yandex_market
    const campaignId = shop.shop_id_external?.trim()
    const shopSku = sku?.trim()
    const wh = warehouseId?.trim()
    const whNum = Number(wh)
    if (!campaignId) {
      const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'missing_campaign' })
      return { status: 'skipped', reason: 'missing_campaign', quantity: clamped, logId }
    }
    if (!shopSku) {
      const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'missing_sku' })
      return { status: 'skipped', reason: 'missing_sku', quantity: clamped, logId }
    }
    if (!wh || !Number.isFinite(whNum)) {
      const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'missing_warehouse' })
      return { status: 'skipped', reason: 'missing_warehouse', quantity: clamped, logId }
    }
    url = `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/offers/stocks`
    method = 'PUT'
    identifier = shopSku
    whId = wh
    // updatedAt = moment of computation (stable across retries): use the value
    // the caller stamped alongside `version`; fall back to now only if omitted.
    const updatedAt = params.updatedAt ?? new Date().toISOString()
    body = JSON.stringify({
      skus: [{
        sku: shopSku,
        warehouseId: whNum,
        items: [{ count: clamped, type: 'FIT', updatedAt }],
      }],
    })
  }

  // 5. Freshness guard — refuse a stale/out-of-order write (HARD: monotonic
  //    version per shop+sku). A newer version already recorded means this write
  //    would leapfrog a correct value backwards; drop it.
  if (params.freshnessKey) {
    const [st] = await db.select({ version: stockSyncState.version })
      .from(stockSyncState)
      .where(and(eq(stockSyncState.shop_id, shop.id), eq(stockSyncState.sku, params.freshnessKey)))
    if (st && version < st.version) {
      logger.warn('stock_write_stale', { shopId: shop.id, key: params.freshnessKey, writeVersion: version, currentVersion: st.version })
      const logId = await audit({ ...base, dry_run: false, endpoint: url, method, identifier, warehouse_id: whId, status: 'skipped', reason: 'stale_version' })
      return { status: 'skipped', reason: 'stale_version', quantity: clamped, logId }
    }
  }

  // 6. Decrypt the token.
  const token = shop.api_key_encrypted ? decrypt(shop.api_key_encrypted) : ''
  if (!token) {
    const logId = await audit({ ...base, dry_run: false, endpoint: url, method, identifier, warehouse_id: whId, status: 'skipped', reason: 'no_token' })
    return { status: 'skipped', reason: 'no_token', quantity: clamped, logId }
  }

  const headers: Record<string, string> = marketplace === 'uzum'
    ? { Authorization: token, Accept: 'application/json', 'Content-Type': 'application/json' } // Uzum: no "Bearer" prefix
    : { 'Api-Key': token, Accept: 'application/json', 'Content-Type': 'application/json' }

  // 7. LIVE: send through the shared guard with stock-write intent. Writes are
  //    always live — no dry-run gate. Kill switch (step 1), read-only/scope/
  //    identifier/freshness guards above, and the URL-exact readonly guard below
  //    are the safety layers; transparency is the audit log + notification.
  try {
    const res = await sendWithRetry(url, { method, headers, body, intent: 'stock-write' })
    let respText = ''
    try { respText = await res.text() } catch { /* ignore */ }
    const status: StockWriteStatus = res.ok ? 'sent' : 'error'
    if (!res.ok) {
      logger.error('stock_write_http_error', { shopId: shop.id, marketplace, url, http: res.status, body: respText.slice(0, 300) })
    }
    const logId = await audit({
      ...base, dry_run: false, endpoint: url, method, identifier, warehouse_id: whId,
      status, reason: res.ok ? 'ok' : `http_${res.status}`, http_status: res.status,
      request_body: body, response_body: respText.slice(0, 2000),
    })
    return { status, reason: res.ok ? undefined : `http_${res.status}`, quantity: clamped, httpStatus: res.status, logId }
  } catch (err) {
    const blocked = err instanceof Error && /GUARD/.test(err.message)
    const status: StockWriteStatus = blocked ? 'blocked' : 'error'
    logger.error('stock_write_error', { shopId: shop.id, marketplace, url, blocked, error: String(err).slice(0, 300) })
    const logId = await audit({
      ...base, dry_run: false, endpoint: url, method, identifier, warehouse_id: whId,
      status, reason: blocked ? 'guard_blocked' : 'exception', request_body: body, error: String(err).slice(0, 500),
    })
    return { status, reason: blocked ? 'guard_blocked' : 'exception', quantity: clamped, logId }
  }
}
