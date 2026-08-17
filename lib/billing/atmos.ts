/**
 * ATMOS API client — SERVER ONLY.
 *
 * The single module the rest of billing depends on. It owns:
 *   • OAuth token cache (client_credentials) with proactive refresh + 401 retry
 *   • createInvoice()      — hosted-checkout invoice (card entry on ATMOS's page)
 *   • getInvoiceStatus()   — authoritative status re-query, normalized
 *   • verifyCallbackSign() — the classic + MD5 callback signature (isolated)
 *   • callback source-IP allowlist helpers
 *
 * Everything else in billing consumes ONLY our normalized shapes — never a raw
 * ATMOS field. NO card data (PAN/CVV/expiry) ever touches this server: the card
 * is entered on ATMOS's hosted page. All money is integer TIYIN (1 UZS = 100).
 *
 * Secrets come from process.env, are validated lazily (a missing var fails one
 * payment with a clear error, never crashes the app), and are NEVER logged.
 */

import 'server-only'
import {
  verifyCallbackSign, atmosCallbackSignPayload, computeCallbackSign,
  ipInCidr, ipInAnyCidr, ipv4ToInt, clientIpFromForwarded, type CallbackSignParts,
} from './atmos-verify'

// Re-export the pure verification helpers so the rest of billing depends only on
// this module. Their implementations live in ./atmos-verify (no server-only) so
// they stay unit-testable under `node --test`.
export {
  verifyCallbackSign, atmosCallbackSignPayload, computeCallbackSign,
  ipInCidr, ipInAnyCidr, ipv4ToInt, clientIpFromForwarded,
}
export type { CallbackSignParts }

// ── Errors ───────────────────────────────────────────────────────────────────

export class AtmosConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'AtmosConfigError' }
}
export class AtmosApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus?: number,
  ) { super(message); this.name = 'AtmosApiError' }
}

// ── Config (lazy, env-only, never logged) ────────────────────────────────────

export interface AtmosConfig {
  baseUrl: string
  storeId: string
  consumerKey: string
  consumerSecret: string
  callbackApiKey: string
  serviceIkpu: string
  successUrl: string
  /** Source-IP allowlist for the callback. Default OFF in DEV until confirmed. */
  ipAllowlistEnabled: boolean
  callbackCidr: string
}

function req(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new AtmosConfigError(`ATMOS is not configured: missing env var ${name}`)
  return v.trim()
}

export function getConfig(): AtmosConfig {
  return {
    baseUrl:        (process.env.ATMOS_BASE_URL?.trim() || 'https://apigw.atmos.uz').replace(/\/$/, ''),
    storeId:        req('ATMOS_STORE_ID'),
    consumerKey:    req('ATMOS_CONSUMER_KEY'),
    consumerSecret: req('ATMOS_CONSUMER_SECRET'),
    callbackApiKey: req('ATMOS_CALLBACK_API_KEY'),
    serviceIkpu:    req('ATMOS_SERVICE_IKPU'),
    successUrl:     req('ATMOS_SUCCESS_URL'),
    // Toggleable; defaults OFF so DEV/sandbox works before ATMOS confirms the range.
    ipAllowlistEnabled: /^(1|true|on|yes)$/i.test(process.env.ATMOS_CALLBACK_IP_ALLOWLIST?.trim() || ''),
    // Comma-separated CIDR list. Real ATMOS callbacks arrive from the CDN77
    // Amsterdam pool 152.233.12.0/23 in production (the documented 92.63.207.0/24
    // does NOT match live traffic), so BOTH ranges are allowed by default — a
    // single documented CIDR would silently reject real payments if the allowlist
    // is ever turned on. Override with ATMOS_CALLBACK_CIDR (comma-separated).
    callbackCidr:   process.env.ATMOS_CALLBACK_CIDR?.trim() || '152.233.12.0/23,92.63.207.0/24',
  }
}

// ── OAuth token: module-scope cache, refresh <5 min to expiry, 401 → refresh+retry ──

const REFRESH_MARGIN_MS = 5 * 60 * 1000
let tokenCache: { token: string; expiresAt: number } | null = null

/** For tests: drop the cached token. */
export function _resetTokenCache(): void { tokenCache = null }

async function fetchToken(cfg: AtmosConfig): Promise<{ token: string; expiresIn: number }> {
  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64')
  const res = await fetch(`${cfg.baseUrl}/token?grant_type=client_credentials`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
  if (!res.ok || !json.access_token) {
    throw new AtmosApiError('token_failed', `token request failed (HTTP ${res.status})`, res.status)
  }
  return { token: json.access_token, expiresIn: Number(json.expires_in) || 3600 }
}

async function getToken(force = false): Promise<string> {
  const now = Date.now()
  if (!force && tokenCache && tokenCache.expiresAt - REFRESH_MARGIN_MS > now) return tokenCache.token
  const cfg = getConfig()
  const { token, expiresIn } = await fetchToken(cfg)
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 }
  return token
}

// Bearer-authenticated JSON POST. On 401, force a token refresh ONCE and retry.
async function authedPost<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const cfg = getConfig()
  const send = (bearer: string) => fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  let token = await getToken()
  let res = await send(token)
  if (res.status === 401) {
    token = await getToken(true)   // force-refresh once
    res = await send(token)
  }
  const json = (await res.json().catch(() => null)) as T | null
  if (!res.ok || json == null) {
    throw new AtmosApiError('api_failed', `${path} failed (HTTP ${res.status})`, res.status)
  }
  return json
}

// ── Response field picking (defensive: read top-level, fall back to nested) ───

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v) return v
    if (typeof v === 'number') return String(v)
  }
  return undefined
}
function asRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object') ? (v as Record<string, unknown>) : {}
}

// ── createInvoice (hosted checkout) ──────────────────────────────────────────

export interface CreateInvoiceParams {
  /** Create-call idempotency key (our payments.request_id). */
  requestId: string
  /** Reconciliation key echoed back in the callback — our internal payment id. */
  account: string
  /** Authoritative charged amount in TIYIN. */
  amountTiyin: number
  /** Fiscal line name, e.g. "Daromadchi — подписка (Pro, 1 мес)". */
  itemName: string
}

export interface CreateInvoiceResult {
  paymentId: string
  url: string
  token?: string
  raw: Record<string, unknown>
}

export async function createInvoice(p: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  const cfg = getConfig()
  // Every field here MUST be snake_case + lowercase (ATMOS rejects camelCase).
  const body = {
    request_id: p.requestId,
    store_id: Number(cfg.storeId),
    // ATMOS requires BOTH keys to be PRESENT, even empty. Verified on the live DEV
    // sandbox (store 11054): empty strings return code 0. An integer
    // expiration_time or a formatted expiration_date string both fail — empty
    // strings for both is the working shape.
    expiration_time: '',
    expiration_date: '',
    account: String(p.account),
    amount: p.amountTiyin,
    success_url: cfg.successUrl,
    items: [
      {
        items_id: '1',
        code: cfg.serviceIkpu,
        name: p.itemName,
        amount: p.amountTiyin,   // single line == total
        quantity: 1,             // quantity 1 avoids unit-vs-total ambiguity
        // details is a single OBJECT, not an array — the array form returns
        // -999999 "System error"; the object form is verified to return code 0.
        details: { name: 'quantity', values: '1' },
      },
    ],
  }

  const json = await authedPost<Record<string, unknown>>('/checkout/invoice/create', body)
  const nested = asRecord(json.invoice ?? json.data)
  const paymentId = pickString(json, ['payment_id', 'paymentId']) ?? pickString(nested, ['payment_id', 'paymentId'])
  const url = pickString(json, ['url', 'checkout_url', 'payment_url']) ?? pickString(nested, ['url', 'checkout_url', 'payment_url'])
  const token = pickString(json, ['token', 'invoice_token']) ?? pickString(nested, ['token', 'invoice_token'])

  if (!paymentId || !url) {
    throw new AtmosApiError('bad_invoice_response', 'ATMOS invoice response missing payment_id or url')
  }
  return { paymentId, url, token, raw: json }
}

// ── getInvoiceStatus (authoritative re-query) ────────────────────────────────

export interface NormalizedInvoiceStatus {
  /** true iff ATMOS reports this invoice as successfully paid. */
  paid: boolean
  /** The raw state/status string ATMOS reported (for logging), if any. */
  state: string | null
  raw: Record<string, unknown>
}

// Success signals. ATMOS reports a state/success indicator on the invoice/get
// response; the exact field is confirmed against the sandbox before go-live.
// We treat an explicit SUCCESS/PAID/CONFIRMED state (any case) OR success===true
// OR a "successfully paid" transaction status as paid, and NOTHING else.
const SUCCESS_STATES = new Set(['success', 'paid', 'confirmed', 'successfully paid', 'succeeded'])

function normalizeInvoiceStatus(json: Record<string, unknown>): NormalizedInvoiceStatus {
  const scopes = [json, asRecord(json.invoice), asRecord(json.data), asRecord(json.result)]
  let state: string | null = null
  for (const s of scopes) {
    const raw = pickString(s, ['state', 'status', 'invoice_status', 'transaction_status'])
    if (raw) { state = raw; break }
  }
  const explicitFlag = scopes.some(s => s.success === true || s.paid === true)
  const stateSaysPaid = state != null && SUCCESS_STATES.has(state.trim().toLowerCase())
  return { paid: explicitFlag || stateSaysPaid, state, raw: json }
}

/** Pass payment_id OR token, never both. Here we key off the ATMOS payment_id. */
export async function getInvoiceStatus(paymentId: string): Promise<NormalizedInvoiceStatus> {
  const json = await authedPost<Record<string, unknown>>('/checkout/invoice/get', { payment_id: paymentId })
  return normalizeInvoiceStatus(json)
}

// ── Callback signature + source-IP allowlist ─────────────────────────────────
//
// The MD5 sign verifier and CIDR matcher are the pure helpers imported/re-exported
// above (./atmos-verify). Only the config-aware toggle lives here.

/** True when the callback source IP is permitted. Allowlist OFF ⇒ always true.
 *  When ON, the IP must fall in ANY of the configured CIDRs (see callbackCidr). */
export function isCallbackIpAllowed(ip: string | null, cfg: AtmosConfig = getConfig()): boolean {
  if (!cfg.ipAllowlistEnabled) return true
  return !!ip && ipInAnyCidr(ip, cfg.callbackCidr)
}

// ─────────────────────────────────────────────────────────────────────────────
// TODO(Phase 2 — recurring, DO NOT BUILD YET):
// Silent renewals will use the hosted card-binding flow to get a REUSABLE card
// token without any PAN ever touching our servers:
//   POST `${BASE}/checkout/card-bind/create`  → returns a checkout.atmos.uz/bind
//   URL; the customer binds their card on ATMOS's hosted page; we receive a card
//   token we can later charge non-interactively. Still PCI-safe (no PAN here).
// Persist the token encrypted (subscriptions.card_token_encrypted, reserved) and
// charge on schedule. Get single hosted-checkout payments working end-to-end
// FIRST — this block is a placeholder only.
// ─────────────────────────────────────────────────────────────────────────────
