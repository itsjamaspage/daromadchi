/**
 * ATMOS API client — OAuth token cache + typed request wrapper + invoice calls.
 *
 * The HTTP layer is injectable so all logic is unit-testable WITHOUT network
 * (this sandbox cannot reach apigw.atmos.uz). Live verification happens on the VPS.
 *
 * ⚠️ FLAG: the exact request/response field names for checkout/invoice/create and
 * /get are marked TODO(atmos) and must be confirmed against the ATMOS docs before
 * go-live. The OAuth token contract (Basic auth + grant_type=client_credentials)
 * is well-defined and implemented as-is.
 */

import { getAtmosEnv, type AtmosEnv } from './env'
import { AtmosApiError, isOkResult, type AtmosResponse } from './types'

// ── OAuth token ──────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  expires_in: number
}

export type TokenFetcher = (env: AtmosEnv) => Promise<TokenResponse>

// Real token fetch: POST {authUrl} with Authorization: Basic base64(key:secret),
// grant_type=client_credentials.
export const fetchAtmosToken: TokenFetcher = async (env) => {
  const basic = Buffer.from(`${env.consumerKey}:${env.consumerSecret}`).toString('base64')
  const res = await fetch(env.authUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse>
  if (!res.ok || !json.access_token) {
    throw new AtmosApiError('TOKEN_ERROR', `token request failed (HTTP ${res.status})`, res.status)
  }
  return { access_token: json.access_token, expires_in: Number(json.expires_in) || 3600 }
}

export interface TokenManagerDeps {
  env?: () => AtmosEnv
  fetchToken?: TokenFetcher
  now?: () => number
  /** Refresh this many ms BEFORE expiry so a token never expires mid-request. */
  refreshMarginMs?: number
}

// In-process token cache with proactive refresh. Factory form so tests can inject
// a fake fetcher and a controllable clock.
export function createTokenManager(deps: TokenManagerDeps = {}) {
  const env = deps.env ?? getAtmosEnv
  const fetchToken = deps.fetchToken ?? fetchAtmosToken
  const now = deps.now ?? Date.now
  const margin = deps.refreshMarginMs ?? 60_000
  let cache: { token: string; expiresAt: number } | null = null

  return {
    async get(): Promise<string> {
      const t = now()
      if (cache && cache.expiresAt - margin > t) return cache.token
      const { access_token, expires_in } = await fetchToken(env())
      cache = { token: access_token, expiresAt: t + expires_in * 1000 }
      return access_token
    },
    reset(): void { cache = null },
    peek(): { token: string; expiresAt: number } | null { return cache },
  }
}

// Default process-wide manager used by the route handlers.
const defaultManager = createTokenManager()
export function getAccessToken(): Promise<string> { return defaultManager.get() }
export function resetTokenCache(): void { defaultManager.reset() }

// ── Request wrapper ──────────────────────────────────────────────────────────

// POST a JSON body to an ATMOS API path with the Bearer token. Parses the
// { result: {code, description} } envelope and throws AtmosApiError on non-OK.
export async function atmosPost<T = unknown>(
  path: string,
  body: unknown,
  token: string,
  env: AtmosEnv = getAtmosEnv(),
): Promise<AtmosResponse<T>> {
  const res = await fetch(`${env.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  let json: AtmosResponse<T>
  try {
    json = (await res.json()) as AtmosResponse<T>
  } catch {
    throw new AtmosApiError('BAD_RESPONSE', `non-JSON response (HTTP ${res.status})`, res.status)
  }
  if (!isOkResult(json.result)) {
    const code = json.result?.code ?? `HTTP_${res.status}`
    throw new AtmosApiError(code, json.result?.description ?? 'ATMOS error', res.status)
  }
  return json
}

// ── Invoice (hosted checkout) ────────────────────────────────────────────────

// One OFD/fiscal line. IKPU/OFD code is a hard requirement for fiscalization.
export interface AtmosOfdItem {
  ikpu: string       // TODO(atmos): real SaaS-subscription IKPU code (placeholder in config)
  title: string
  price: number      // tiyin
  count: number
  vat_percent?: number
}

export interface CreateInvoiceParams {
  amountTiyin: number   // ALWAYS tiyin
  requestId: string     // hosted-checkout idempotency key
  account: string       // our reconciliation key (also echoed in the callback)
  successUrl: string
  items: AtmosOfdItem[]
}

// TODO(atmos): confirm exact field names/shape for checkout/invoice/create.
export async function createInvoice(
  params: CreateInvoiceParams,
  token: string,
  env: AtmosEnv = getAtmosEnv(),
): Promise<AtmosResponse> {
  const body = {
    store_id: env.storeId,
    request_id: params.requestId,   // idempotency key for this create call
    amount: params.amountTiyin,     // tiyin — never an FX-derived number
    account: params.account,
    success_url: params.successUrl,
    items: params.items,
  }
  return atmosPost('/checkout/invoice/create', body, token, env)
}

// Re-query an invoice's status — used for reconciliation when a callback is
// missed or its response was lost (the doc warns to re-check on network drops).
// TODO(atmos): confirm the get endpoint + key (invoice_id vs token).
export async function getInvoice(
  key: { invoice_id?: string; token?: string },
  token: string,
  env: AtmosEnv = getAtmosEnv(),
): Promise<AtmosResponse> {
  return atmosPost('/checkout/invoice/get', { store_id: env.storeId, ...key }, token, env)
}
