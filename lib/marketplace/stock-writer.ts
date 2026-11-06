/**
 * THE single module through which any marketplace stock write may happen.
 * (HARD RULE #2 — all marketplace writes go through here and nowhere else.)
 *
 * `pushStock` updates ONE thing: the stock quantity (ostatok) of one SKU on one
 * shop's live listing. Never price, title, order status, invoices, or anything
 * else. Every attempt is:
 *   • kill-switch checked  (STOCK_SYNC_KILL_SWITCH disables all writes instantly)
 *   • restricted to Uzum only
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
import type { MarketplaceType } from '@/lib/types'

export type StockWriteStatus = 'sent' | 'skipped' | 'blocked' | 'killed' | 'error'

export interface StockWriteShop {
  id: string
  marketplace: MarketplaceType
  api_key_encrypted: string | null
  shop_id_external?: string | null
}

export interface PushStockParams {
  shop: StockWriteShop
  /** Seller article — used in the audit log. */
  sku: string | null
  /** Uzum market barcode (STRING, from /v3/fbs/sku/stocks). Read-side only now —
   *  used by the fbsLinked guard, NOT the write body. */
  barcode: string | null
  /**
   * Uzum FBS skuId (numeric, from GET /v3/fbs/sku/stocks, persisted in
   * products.market_sku). Uzum's FBS stock-update keys on this — required for a
   * Uzum write; a blank value is a hard skip (missing_uzum_skuid).
   */
  uzumSkuId?: string | null
  /**
   * Uzum link flags carried into the write body (both required by the API).
   * Read from the FBS sku-stocks list by barcode; default fbsLinked=true /
   * dbsLinked=false for an FBS-only SKU. They describe WHERE the SKU is linked,
   * not a command.
   */
  uzumFbsLinked?: boolean
  uzumDbsLinked?: boolean
  /** Desired quantity. Clamped to Math.max(0, quantity) before anything else. */
  quantity: number
  /** Monotonic freshness version (per shop+sku). Recorded now; enforced in Phase 4. */
  version: number
  /** products.id for the audit-row FK (optional). */
  productId?: string | null
  /**
   * Match-key for the freshness guard. When set, the write is refused if a newer
   * version has already been recorded for this (shop, key) — a stale/out-of-order
   * write can never leapfrog a correct one. Omit to skip the check.
   */
  freshnessKey?: string
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

/**
 * Gate A dry run (stock-ledger spec §9). When on, every intended write is
 * recorded as a dry_run row carrying the target quantity and NOTHING reaches a
 * marketplace — so the first seeded tick's would-write-vs-current diff can be
 * reviewed before writes go live. Read at RUNTIME inside a function, never at
 * module scope, so the bundler cannot fold it to a compile-time false (the same
 * trap the ledger-shadow flag hit). Promotion is unsetting the env var.
 */
export function ledgerDryRunOn(): boolean {
  const v = (process.env.STOCK_LEDGER_DRY_RUN ?? '').trim().toLowerCase()
  return KILL_SWITCH_VALUES.has(v)
}

interface AuditFields {
  shop_id: string
  product_id?: string | null
  marketplace: MarketplaceType
  sku?: string | null
  identifier?: string | null
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
  const { shop, sku, barcode, uzumSkuId, uzumFbsLinked, uzumDbsLinked, version, productId } = params
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

  // 2. Scope: Uzum only.
  if (marketplace !== 'uzum') {
    const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'marketplace_out_of_scope' })
    return { status: 'skipped', reason: 'marketplace_out_of_scope', quantity: clamped, logId }
  }

  // 4. Build the request. Any missing/blank identifier is a HARD SKIP — we never
  //    attempt a write with a null/blank key (would fail silently or hit the
  //    wrong SKU).
  // Uzum FBS stock-update: POST /v2/fbs/sku/stocks. The body requires ALL FIVE
  // fields — skuId, barcode, amount, fbsLinked, dbsLinked (captured verbatim from
  // the seller cabinet's own write request). Any missing field returns
  // validation-failed-001 (HTTP 400): the earlier barcode-only /v2 body and the
  // skuId+amount /v3 body both failed for this reason.
  //   • skuId   — the FBS skuId (products.market_sku), the update key.
  //   • barcode — the string barcode (products.market_barcode).
  //   • fbsLinked / dbsLinked — WHERE the SKU is linked, echoed from the FBS list
  //     (default true/false for an FBS-only SKU). Not a command.
  const skuId = uzumSkuId?.trim()
  if (!skuId) {
    const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'missing_uzum_skuid' })
    return { status: 'skipped', reason: 'missing_uzum_skuid', quantity: clamped, logId }
  }
  const bc = barcode?.trim()
  if (!bc) {
    const logId = await audit({ ...base, dry_run: false, status: 'skipped', reason: 'missing_barcode' })
    return { status: 'skipped', reason: 'missing_barcode', quantity: clamped, logId }
  }
  const url = `${UZUM_API_BASE}/v2/fbs/sku/stocks`
  const method = 'POST'
  const identifier = skuId
  const body = JSON.stringify({ skuAmountList: [{
    skuId: Number(skuId),
    barcode: bc,
    amount: clamped,
    fbsLinked: uzumFbsLinked ?? true,
    dbsLinked: uzumDbsLinked ?? false,
  }] })

  // 4b. Gate A dry run (spec §9). The request is fully built (identifier,
  //     warehouse, target quantity all resolved), so the recorded row is exactly
  //     what WOULD have been sent — but the marketplace fetch is skipped. Placed
  //     after the request build so the review query sees the real target, and
  //     after the guards above so a write that would skip anyway still skips for
  //     its real reason.
  if (ledgerDryRunOn()) {
    const logId = await audit({ ...base, dry_run: true, endpoint: url, method, identifier, status: 'skipped', reason: 'dry_run', request_body: body })
    return { status: 'skipped', reason: 'dry_run', quantity: clamped, logId }
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
      const logId = await audit({ ...base, dry_run: false, endpoint: url, method, identifier, status: 'skipped', reason: 'stale_version' })
      return { status: 'skipped', reason: 'stale_version', quantity: clamped, logId }
    }
  }

  // 6. Decrypt the token.
  const token = shop.api_key_encrypted ? decrypt(shop.api_key_encrypted) : ''
  if (!token) {
    const logId = await audit({ ...base, dry_run: false, endpoint: url, method, identifier, status: 'skipped', reason: 'no_token' })
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
    // Uzum can return HTTP 200 with business-level errors inside the body
    // (e.g. { "payload": ..., "errors": ["..."] }). Treat that as an error.
    let uzumBodyError = false
    if (res.ok && marketplace === 'uzum' && respText) {
      try {
        const parsed = JSON.parse(respText)
        if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
          uzumBodyError = true
        }
      } catch { /* not JSON — ignore */ }
    }
    const status: StockWriteStatus = res.ok && !uzumBodyError ? 'sent' : 'error'
    const bodySnippet = respText.replace(/\s+/g, ' ').trim().slice(0, 300)
    const machineReason = status === 'sent' ? undefined
      : uzumBodyError ? 'uzum_body_error' : `http_${res.status}`
    const auditReason = status === 'sent'
      ? 'ok'
      : uzumBodyError ? `uzum_body_error: ${bodySnippet}`
      : bodySnippet ? `http_${res.status}: ${bodySnippet}` : `http_${res.status}`
    if (!res.ok || uzumBodyError) {
      logger.error('stock_write_http_error', { shopId: shop.id, marketplace, url, http: res.status, uzumBodyError, body: respText.slice(0, 500) })
    }
    const logId = await audit({
      ...base, dry_run: false, endpoint: url, method, identifier,
      status, reason: auditReason, http_status: res.status,
      request_body: body, response_body: respText.slice(0, 2000),
    })
    return { status, reason: machineReason, quantity: clamped, httpStatus: res.status, logId }
  } catch (err) {
    const blocked = err instanceof Error && /GUARD/.test(err.message)
    const status: StockWriteStatus = blocked ? 'blocked' : 'error'
    logger.error('stock_write_error', { shopId: shop.id, marketplace, url, blocked, error: String(err).slice(0, 300) })
    const logId = await audit({
      ...base, dry_run: false, endpoint: url, method, identifier,
      status, reason: blocked ? 'guard_blocked' : 'exception', request_body: body, error: String(err).slice(0, 500),
    })
    return { status, reason: blocked ? 'guard_blocked' : 'exception', quantity: clamped, logId }
  }
}
