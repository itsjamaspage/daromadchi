/**
 * IMMUTABLE RULE — SET BY OWNER (jkhakimjonov8@gmail.com)
 * DO NOT MODIFY WITHOUT EXPLICIT WRITTEN APPROVAL FROM THE OWNER.
 *
 * All external marketplace API calls (Yandex Market, Uzum, Wildberries) must be
 * read-only. This guard enforces that at runtime: any attempt to use a write method
 * (PUT, PATCH, DELETE) throws immediately and is never sent to the marketplace.
 *
 * POST is permitted only for the specific endpoints listed in APPROVED_POST_ENDPOINTS
 * below — these are read operations that the marketplace API itself requires to be POSTed.
 */

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
  // Yandex Market — united-netting-report (POST to REQUEST a report; the
  // report itself contains READ-ONLY financial/settlement data. Approved
  // by owner in the payouts real-data thread — needed so the Payouts
  // page can display Yandex's actual per-order commission/delivery
  // figures instead of estimates.)
  /api\.partner\.market\.yandex\.ru\/reports\/united-netting-report\/generate/,
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
 * Drop-in replacement for fetch() for all marketplace API calls.
 * Throws before sending if the method is a write operation.
 */
export function marketplaceFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()

  if (WRITE_METHODS.has(method)) {
    throw new Error(
      `[READONLY GUARD] Attempted ${method} to marketplace API: ${url}\n` +
      `The app is strictly read-only. Write calls to marketplace APIs are forbidden.`,
    )
  }

  if (method === 'POST') {
    const allowed = APPROVED_POST_ENDPOINTS.some(pattern => pattern.test(url))
    if (!allowed) {
      throw new Error(
        `[READONLY GUARD] Unapproved POST to marketplace API: ${url}\n` +
        `POST is only allowed for read endpoints listed in lib/marketplace-readonly-guard.ts.\n` +
        `To add a new approved endpoint, get written approval from the owner first.`,
      )
    }
  }

  return fetchWithRetry(url, init)
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
