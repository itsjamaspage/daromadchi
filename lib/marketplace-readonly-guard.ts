/**
 * MARKETPLACE EGRESS GUARD — SET BY OWNER (jkhakimjonov8@gmail.com)
 * DO NOT MODIFY WITHOUT EXPLICIT WRITTEN APPROVAL FROM THE OWNER.
 *
 * Read-only by DEFAULT. Every outbound marketplace request (Yandex Market,
 * Uzum, Wildberries) passes through this one guard — there is no second egress
 * path. The default intent is 'read':
 *   • PUT / PATCH / DELETE  → always rejected.
 *   • POST                  → rejected unless the exact URL is a marketplace
 *                             READ that requires POST (APPROVED_POST_ENDPOINTS).
 *
 * There are exactly TWO sanctioned write exceptions, each narrow and audited:
 *   • intent 'stock-write' — the opt-in, stock-quantity-ONLY writer
 *     (lib/marketplace/stock-writer.ts). Must match the method-exact, URL-exact
 *     APPROVED_STOCK_WRITE_ENDPOINTS (stock endpoints only). Changes nothing but
 *     the ostatok, and only for shops whose owner opted in.
 *   • intent 'order-cancel' — the oversell cancel path
 *     (lib/marketplace/order-cancel.ts). Must match APPROVED_ORDER_CANCEL_ENDPOINTS
 *     and may ONLY cancel (the shared YM status endpoint additionally requires a
 *     CANCELLED body and forbids any forward status).
 * Each writer — and only it — calls this guard with its intent. Anything else
 * with write intent is logged as `blocked` and never sent. Every other
 * marketplace write remains forbidden without fresh written approval from the
 * owner.
 */

import { logger } from './logger'

// Endpoints where POST is the marketplace's own requirement for a READ operation.
// Any POST NOT in this list is rejected.
const APPROVED_POST_ENDPOINTS: RegExp[] = [
  // Yandex Market — offer-mappings (GET returns 405, POST is the read method)
  /api\.partner\.market\.yandex\.ru\/v2\/businesses\/\d+\/offer-mappings/,
  /api\.partner\.market\.yandex\.ru\/v2\/campaigns\/\d+\/offer-mappings/,
  // Yandex Market — stocks (SKU list too large for query string, POST is required read)
  /api\.partner\.market\.yandex\.ru\/v2\/campaigns\/\d+\/offers\/stocks/,
  // Yandex Market — SKU stats (date range in body, POST is required read)
  /api\.partner\.market\.yandex\.ru\/v2\/campaigns\/\d+\/stats\/skus/,
  // Yandex Market — every report-generate endpoint (POST to REQUEST a
  // report, response contains READ-ONLY financial / settlement /
  // realization / stocks data). Approved by owner for real-payout data
  // on the Payouts page. Broad pattern covers united-netting-report,
  // goods-realization, goods-turnover, and any future report type
  // Yandex ships under the same namespace; also covers both the legacy
  // /reports/... path and the newer /businesses/{id}/reports/... one.
  /api\.partner\.market\.yandex\.ru\/reports\/[a-z-]+\/generate/,
  /api\.partner\.market\.yandex\.ru\/businesses\/\d+\/reports\/[a-z-]+\/generate/,
  /api\.partner\.market\.yandex\.ru\/campaigns\/\d+\/reports\/[a-z-]+\/generate/,
  // Wildberries Content API — paginated card list (POST is the read method)
  /content-api\.wildberries\.ru\/content\/v2\/get\/cards\/list/,
  // Wildberries Marketplace API — FBS stock lookup by barcodes (POST is the read
  // method; the write variant is PUT on the same path and remains blocked).
  // Approved by owner in chat for the cross-marketplace leftover feature (2026-07-12).
  /marketplace-api\.wildberries\.ru\/api\/v3\/stocks\/\d+$/,
  // Uzum GraphQL public search API (read-only market research, no auth)
  /^https:\/\/graphql\.uzum\.uz/,
]

const WRITE_METHODS = new Set(['PUT', 'PATCH', 'DELETE'])

/**
 * The ONLY sanctioned marketplace writes. Method-exact AND URL-exact (anchored,
 * no query string) — kept deliberately separate from the read-POST allowlist
 * above so the same-path/different-method cases can never blur together:
 *   • Uzum  stock write:  POST https://api-seller.uzum.uz/.../v2/fbs/sku/stocks
 *   • YM    stock write:  PUT  https://api.partner.market.yandex.ru/v2/campaigns/{id}/offers/stocks
 * Note YM uses POST on that identical /offers/stocks path for a READ (see
 * APPROVED_POST_ENDPOINTS) — only the PUT is a write, and only with write intent.
 * Stock quantity is the ONLY thing any of these change.
 */
const APPROVED_STOCK_WRITE_ENDPOINTS: { marketplace: string; method: string; pattern: RegExp }[] = [
  {
    marketplace: 'uzum',
    method: 'POST',
    pattern: /^https:\/\/api-seller\.uzum\.uz\/api\/seller-openapi\/v2\/fbs\/sku\/stocks$/,
  },
  {
    marketplace: 'yandex_market',
    method: 'PUT',
    pattern: /^https:\/\/api\.partner\.market\.yandex\.ru\/v2\/campaigns\/\d+\/offers\/stocks$/,
  },
]

/**
 * The SECOND sanctioned write family: seller-initiated order CANCELLATION, used
 * only by the oversell auto/one-click cancel path (Phase 4). Separately
 * allowlisted from stock writes and, crucially, cancel-ONLY:
 *   • Uzum — POST …/v1/fbs/order/{id}/cancel is a cancel-specific URL; confirm,
 *     refund, delivering, invoice etc. are different URLs and never match.
 *   • YM — the status endpoint is SHARED with confirm/process, so a URL match is
 *     not enough: the body MUST set status CANCELLED and MUST NOT set any
 *     forward status. This is what proves the cancel path can only cancel.
 */
const APPROVED_ORDER_CANCEL_ENDPOINTS: {
  marketplace: string; method: string; pattern: RegExp; requireBody?: RegExp; forbidBody?: RegExp
}[] = [
  {
    marketplace: 'uzum',
    method: 'POST',
    pattern: /^https:\/\/api-seller\.uzum\.uz\/api\/seller-openapi\/v1\/fbs\/order\/\d+\/cancel$/,
  },
  {
    marketplace: 'yandex_market',
    method: 'PUT',
    pattern: /^https:\/\/api\.partner\.market\.yandex\.ru\/v2\/campaigns\/\d+\/orders\/\d+\/status$/,
    requireBody: /"status"\s*:\s*"CANCELLED"/,
    forbidBody: /"status"\s*:\s*"(PROCESSING|DELIVERY|PICKUP|DELIVERED)"/,
  },
]

// Intent an *individual* request declares. Default (and everything that omits
// it) is 'read'. Only the stock-writer passes 'stock-write'; only the
// order-cancel path passes 'order-cancel'.
export type MarketplaceIntent = 'read' | 'stock-write' | 'order-cancel'

export interface MarketplaceInit extends RequestInit {
  intent?: MarketplaceIntent
}

/**
 * Pure guard decision — no network. Throws if the request is not allowed;
 * returns void when it may proceed. Exported so it can be unit-tested directly
 * (the load-bearing test lives in marketplace-readonly-guard.test.ts).
 */
export function checkMarketplaceRequest(
  url: string,
  method: string,
  intent: MarketplaceIntent = 'read',
  body?: string,
): void {
  const m = method.toUpperCase()

  if (intent === 'stock-write') {
    const match = APPROVED_STOCK_WRITE_ENDPOINTS.find(e => e.method === m && e.pattern.test(url))
    if (!match) {
      // Log as blocked and send nothing. This catches a write-intent request
      // aimed at anything but the exact stock endpoint — a wrong method on the
      // right path (POST vs PUT), a price/order/invoice URL, or a typo.
      logger.warn('marketplace_write_blocked', { method: m, url, reason: 'not_in_stock_write_allowlist' })
      throw new Error(
        `[STOCK-WRITE GUARD] Blocked ${m} to marketplace API: ${url}\n` +
        `The only sanctioned marketplace writes are the exact stock endpoints. Nothing else is sent.`,
      )
    }
    return
  }

  if (intent === 'order-cancel') {
    const match = APPROVED_ORDER_CANCEL_ENDPOINTS.find(e => e.method === m && e.pattern.test(url))
    const bodyOk = match
      && (!match.requireBody || (body != null && match.requireBody.test(body)))
      && (!match.forbidBody || !(body != null && match.forbidBody.test(body)))
    if (!match || !bodyOk) {
      logger.warn('marketplace_cancel_blocked', { method: m, url, reason: !match ? 'not_in_cancel_allowlist' : 'body_not_a_cancellation' })
      throw new Error(
        `[ORDER-CANCEL GUARD] Blocked ${m} to marketplace API: ${url}\n` +
        `The cancel path may ONLY cancel — it cannot confirm, refund, or otherwise mutate an order.`,
      )
    }
    return
  }

  // ── Default: read intent. Writes are forbidden here regardless of URL. ──
  if (WRITE_METHODS.has(m)) {
    throw new Error(
      `[READONLY GUARD] Attempted ${m} to marketplace API: ${url}\n` +
      `Read-only by default. Marketplace writes go only through the audited stock-writer.`,
    )
  }

  if (m === 'POST') {
    const allowed = APPROVED_POST_ENDPOINTS.some(pattern => pattern.test(url))
    if (!allowed) {
      throw new Error(
        `[READONLY GUARD] Unapproved POST to marketplace API: ${url}\n` +
        `POST is only allowed for the read endpoints listed in lib/marketplace-readonly-guard.ts.\n` +
        `To add a new approved endpoint, get written approval from the owner first.`,
      )
    }
  }
}

/**
 * Drop-in replacement for fetch() for all marketplace API calls. Runs the guard
 * decision, then (only if allowed) performs the fetch. Existing read callers pass
 * no `intent` and keep the exact prior behaviour; the stock-writer passes
 * `intent: 'stock-write'`.
 */
export function marketplaceFetch(url: string, init?: MarketplaceInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const intent = init?.intent ?? 'read'
  const bodyStr = typeof init?.body === 'string' ? init.body : undefined

  checkMarketplaceRequest(url, method, intent, bodyStr)

  // Strip the non-standard `intent` field before handing the init to fetch().
  const fetchInit: MarketplaceInit = { ...init }
  delete fetchInit.intent
  return fetchWithRetry(url, fetchInit)
}

const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 2_000
const REQUEST_TIMEOUT_MS = 30_000

function isTransient(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const res = await fetch(url, { ...init, signal: init?.signal ?? controller.signal })
      clearTimeout(timeout)
      if (isTransient(res.status) && attempt < MAX_RETRIES) {
        await sleep(INITIAL_DELAY_MS * 2 ** attempt)
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_DELAY_MS * 2 ** attempt)
        continue
      }
    }
  }
  throw lastErr
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
