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
import { logger } from '@/lib/logger'
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
  /** Separate API key for the hosted card-bind callback (Visa/MC flow). */
  bindCallbackApiKey: string
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
    callbackApiKey:     req('ATMOS_CALLBACK_API_KEY'),
    bindCallbackApiKey: process.env.ATMOS_BIND_CALLBACK_API_KEY?.trim() || '',
    serviceIkpu:        req('ATMOS_SERVICE_IKPU'),
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
    const hint = json ? JSON.stringify(json).slice(0, 300) : '(no body)'
    throw new AtmosApiError('api_failed', `${path} failed (HTTP ${res.status}): ${hint}`, res.status)
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

/**
 * @deprecated Hosted checkout returns -999999 for our store (broken on ATMOS's
 * side). Billing is moving to the direct card-binding flow (payCreate /
 * bindCard* / payPreApply / payApply above). Kept only until the billing UI stops
 * calling /api/billing/atmos/create; do not use for new code.
 */
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

// ── Direct card-binding flow (the WORKING path) ──────────────────────────────
//
// The hosted /checkout/invoice/create endpoint returns -999999 for our store
// (broken on ATMOS's side), so billing uses ATMOS's direct API, verified live on
// the VPS against store 11054. Business errors arrive as HTTP 200 with
// {result:{code,description}} — success is result.code==='OK'. Amounts are TIYIN;
// card expiry is "YYmm" (03/29 → "2903"). NO PAN is ever stored or logged.

function atmosResultCode(json: Record<string, unknown>): { code: string; description: string } {
  const r = asRecord(json.result)
  return { code: String(r.code ?? ''), description: String(r.description ?? '') }
}

/** Throw on an explicit non-OK result.code; pass when it's OK or absent. */
function assertAtmosOk(json: Record<string, unknown>, ctx: string): void {
  const { code, description } = atmosResultCode(json)
  if (code && code.toUpperCase() !== 'OK') {
    throw new AtmosApiError(code, `${ctx} failed: ${description || 'ATMOS error'} (${code})`)
  }
}

function pickDeep(json: Record<string, unknown>, keys: string[]): string | undefined {
  return pickString(json, keys)
    ?? pickString(asRecord(json.result), keys)
    ?? pickString(asRecord(json.data), keys)
}

export interface PayCreateResult { transactionId: string; raw: Record<string, unknown> }
/** Create a charge draft for our `account` (our internal payment id). TIYIN. */
export async function payCreate(account: string, amountTiyin: number): Promise<PayCreateResult> {
  const cfg = getConfig()
  const json = await authedPost<Record<string, unknown>>('/merchant/pay/create', {
    amount: amountTiyin, account: String(account), store_id: Number(cfg.storeId),
  })
  assertAtmosOk(json, 'pay/create')
  const transactionId = pickDeep(json, ['transaction_id', 'transactionId'])
  if (!transactionId) throw new AtmosApiError('bad_response', 'pay/create returned no transaction_id')
  return { transactionId, raw: json }
}

export interface BindInitResult { transactionId: string; raw: Record<string, unknown> }
/** Begin card binding — ATMOS sends an SMS OTP to the cardholder. expiry is "YYmm". */
export async function bindCardInit(cardNumber: string, expiryYYmm: string): Promise<BindInitResult> {
  const json = await authedPost<Record<string, unknown>>('/partner/bind-card/init', {
    card_number: String(cardNumber), expiry: String(expiryYYmm),
  })
  assertAtmosOk(json, 'bind-card/init')
  const transactionId = pickDeep(json, ['transaction_id', 'transactionId'])
  if (!transactionId) throw new AtmosApiError('bad_response', 'bind-card/init returned no transaction_id')
  return { transactionId, raw: json }
}

export interface BindConfirmResult {
  cardToken: string
  cardId: string | null
  panMasked: string | null
  cardHolder: string | null
  raw: Record<string, unknown>
}
/** Confirm card binding with the SMS OTP → reusable card token (+ masked pan for display). */
export async function bindCardConfirm(transactionId: string, otp: string): Promise<BindConfirmResult> {
  const json = await authedPost<Record<string, unknown>>('/partner/bind-card/confirm', {
    transaction_id: String(transactionId), otp: String(otp),
  })
  assertAtmosOk(json, 'bind-card/confirm')
  const cardToken = pickDeep(json, ['card_token', 'cardToken', 'token'])
  if (!cardToken) throw new AtmosApiError('bad_response', 'bind-card/confirm returned no card_token')
  return {
    cardToken,
    cardId:     pickDeep(json, ['card_id', 'cardId']) ?? null,
    panMasked:  pickDeep(json, ['pan', 'card_number', 'masked_pan', 'card_pan']) ?? null,
    cardHolder: pickDeep(json, ['card_holder', 'cardholder', 'holder', 'fullname']) ?? null,
    raw: json,
  }
}

/** Stage a token charge before applying it. */
export async function payPreApply(transactionId: string, cardToken: string): Promise<Record<string, unknown>> {
  const cfg = getConfig()
  const json = await authedPost<Record<string, unknown>>('/merchant/pay/pre-apply', {
    transaction_id: String(transactionId), card_token: String(cardToken), store_id: Number(cfg.storeId),
  })
  assertAtmosOk(json, 'pay/pre-apply')
  return json
}

/** Apply (capture) the charge. For token payments the OTP is the LITERAL "111111". */
export async function payApply(transactionId: string, otp: string): Promise<Record<string, unknown>> {
  const cfg = getConfig()
  const json = await authedPost<Record<string, unknown>>('/merchant/pay/apply', {
    transaction_id: String(transactionId), otp: String(otp), store_id: Number(cfg.storeId),
  })
  assertAtmosOk(json, 'pay/apply')
  return json
}

/** OTP literal ATMOS requires for token (card-bound) charges — never an SMS code. */
export const TOKEN_PAYMENT_OTP = '111111'

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

// ── Hosted card-binding (Visa / Mastercard) ─────────────────────────────────
//
// UzCard/Humo cards bind via the direct /partner/bind-card/* flow above.
// Visa and Mastercard domestic cards require a DIFFERENT ATMOS endpoint:
//   POST /checkout/card-bind/create → ATMOS hosted page where the user enters
//   card + OTP → callback to us with { api_key, card_id } → we respond 200
//   { status: 1, message: "Успешно" } → user redirected to success_url.
//
// Charging a card_id-bound card uses the MPS flow, not the merchant/pay flow:
//   POST /mps/pay/transaction/pre-create  → { payload: { id } }
//   POST /mps/pay/transaction/create/bind → instant charge (no OTP)

export interface HostedBindCreateParams {
  requestId: string
  account: string
  successUrl: string
}

export interface HostedBindCreateResult {
  paymentId: string
  token: string
  url: string
  raw: Record<string, unknown>
}

export async function hostedBindCreate(p: HostedBindCreateParams): Promise<HostedBindCreateResult> {
  const cfg = getConfig()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://daromadchi.uz').replace(/\/$/, '')
  const json = await authedPost<Record<string, unknown>>('/checkout/card-bind/create', {
    request_id: p.requestId,
    store_id: Number(cfg.storeId),
    account: String(p.account),
    success_url: p.successUrl,
    callback_url: `${appUrl}/api/billing/atmos/callback`,
  })
  assertAtmosOk(json, 'card-bind/create')
  const paymentId = pickDeep(json, ['payment_id', 'paymentId'])
  const token = pickDeep(json, ['token'])
  const url = pickDeep(json, ['url', 'checkout_url', 'bind_url'])
  if (!paymentId || !url) {
    throw new AtmosApiError('bad_response', 'card-bind/create returned no payment_id or url')
  }
  return { paymentId, token: token ?? '', url, raw: json }
}

// ── MPS charging (for card_id-bound cards) ──────────────────────────────────

export interface MpsPreCreateParams {
  amountTiyin: number
  extId: string
  account: string
  invoiceId?: string
}

export interface MpsPreCreateResult {
  transactionId: string
  raw: Record<string, unknown>
}

export async function mpsPreCreate(p: MpsPreCreateParams): Promise<MpsPreCreateResult> {
  const cfg = getConfig()
  const json = await authedPost<Record<string, unknown>>('/mps/pay/transaction/pre-create', {
    amount: p.amountTiyin,
    ext_id: p.extId,
    store_id: Number(cfg.storeId),
    account: p.account,
    invoice_id: p.invoiceId ?? p.extId,
    ofd_items: [{
      items_id: '1',
      code: cfg.serviceIkpu,
      name: 'Daromadchi — obuna',
      amount: p.amountTiyin,
      quantity: 1,
      details: { name: 'quantity', values: '1' },
    }],
  })
  logger.info('atmos_mps_pre_create_response', { amount: p.amountTiyin, account: p.account, raw: json })
  assertAtmosOk(json, 'mps/pre-create')
  const payload = asRecord(json.payload ?? json.data ?? json)
  const tid = pickString(payload, ['id', 'transaction_id']) ?? pickDeep(json, ['id', 'transaction_id'])
  if (!tid) throw new AtmosApiError('bad_response', 'mps/pre-create returned no transaction id')
  return { transactionId: String(tid), raw: json }
}

export interface MpsCreateBindParams {
  cardId: string
  amountTiyin: number
  transactionId: string
  clientIp?: string
}

export interface MpsCreateBindResult {
  transactionId: string
  resultCode: string
  raw: Record<string, unknown>
}

export async function mpsCreateBind(p: MpsCreateBindParams): Promise<MpsCreateBindResult> {
  const json = await authedPost<Record<string, unknown>>('/mps/pay/transaction/create/bind', {
    card_id: Number(p.cardId),
    amount: p.amountTiyin,
    transaction_id: Number(p.transactionId),
    client_ip_addr: p.clientIp ?? '127.0.0.1',
  })
  logger.info('atmos_mps_create_bind_response', { cardId: p.cardId, amount: p.amountTiyin, raw: json })
  assertAtmosOk(json, 'mps/create-bind')
  const payload = asRecord(json.payload ?? json.data ?? json)
  const resultCode = pickString(payload, ['result_code', 'resultCode'])
    ?? pickDeep(json, ['result_code', 'resultCode'])
    ?? ''
  const tid = pickString(payload, ['id', 'transaction_id']) ?? pickDeep(json, ['id', 'transaction_id']) ?? p.transactionId
  if (!resultCode) {
    throw new AtmosApiError('no_result_code', `MPS charge returned no result_code — raw: ${JSON.stringify(json).slice(0, 500)}`)
  }
  if (resultCode.toLowerCase() !== 'approved') {
    throw new AtmosApiError(resultCode, `MPS charge declined: ${resultCode}`)
  }
  return { transactionId: String(tid), resultCode, raw: json }
}

// ── Card details (lookup by card_id) ────────────────────────────────────────

export interface CardDetails {
  cardId: string
  cardType: string | null
  panMasked: string | null
  raw: Record<string, unknown>
}

async function authedGet<T = Record<string, unknown>>(path: string): Promise<T> {
  const cfg = getConfig()
  const send = (bearer: string) => fetch(`${cfg.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
    },
  })
  let token = await getToken()
  let res = await send(token)
  if (res.status === 401) {
    token = await getToken(true)
    res = await send(token)
  }
  const json = (await res.json().catch(() => null)) as T | null
  if (!res.ok || json == null) {
    const hint = json ? JSON.stringify(json).slice(0, 300) : '(no body)'
    throw new AtmosApiError('api_failed', `${path} failed (HTTP ${res.status}): ${hint}`, res.status)
  }
  return json
}

export async function getCardDetails(cardId: string): Promise<CardDetails> {
  const json = await authedGet<Record<string, unknown>>(`/mps/pay/card/${cardId}`)
  const payload = asRecord(json.payload ?? json.data ?? json)
  return {
    cardId: String(cardId),
    cardType: pickString(payload, ['card_type', 'cardType']) ?? null,
    panMasked: pickString(payload, ['pan', 'card_number', 'masked_pan']) ?? null,
    raw: json,
  }
}
