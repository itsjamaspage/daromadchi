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
  // Wildberries Content API — paginated card list (POST is the read method)
  /content-api\.wildberries\.ru\/content\/v2\/get\/cards\/list/,
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

  return fetch(url, init)
}
