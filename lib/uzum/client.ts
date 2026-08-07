// Uzum Market Seller API client
// Base URL: https://api-seller.uzum.uz/api/seller-openapi
// Auth: Bearer token from seller.uzum.uz → Settings → API
// Products: GET /v1/shops → shopId, then GET /v1/product/shop/{shopId}
// Swagger (requires login): https://api-seller.uzum.uz/api/seller-openapi/swagger/swagger-ui/webjars/swagger-ui/index.html

import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

export const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi'

export class UzumApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: string,
  ) {
    super(message)
    this.name = 'UzumApiError'
  }
}

// Exponential backoff for transient errors (429, 5xx). Rate limits (429) get a
// longer wait than 5xx because Uzum's limiter needs real time to reset —
// otherwise a throttled request fails and its orders are silently skipped.
async function withRetry<T>(fn: () => Promise<T>, retries = 4, baseMs = 600): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err instanceof UzumApiError ? err.status : 0
      const retryable = status === 429 || status >= 500
      if (!retryable || attempt === retries) throw err
      const base = status === 429 ? 2000 : baseMs
      await new Promise(r => setTimeout(r, base * 2 ** attempt))
    }
  }
  throw new Error('unreachable')
}

// Auth: apiKey in Authorization header WITHOUT any prefix ("без префикса Bearer")
// Per Uzum swagger securitySchemes.TokenAuth.description
async function request<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const t = token.trim()
  // Match the request shape /api/uzum/diagnose proved working: Authorization +
  // Accept only. Do NOT send Content-Type on GET — a body-less GET declaring
  // application/json can be rejected with the same generic 400 Uzum returns
  // for any malformed request, and that 400 used to be swallowed silently.
  const method = String(options?.method ?? 'GET').toUpperCase()
  const res = await marketplaceFetch(`${UZUM_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: t,
      Accept: 'application/json',
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new UzumApiError(res.status, `Uzum API error: ${res.status} ${res.statusText} (${path})`, body)
  }
  return res.json() as Promise<T>
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface UzumOrderItem {
  productId: number
  productName: string
  quantity: number
  price: number // unit price in so'm
}

export interface UzumOrder {
  orderId: string
  orderNumber: string
  customerName: string
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED'
  createdAt: string // ISO date
  items: UzumOrderItem[]
  totalPrice: number
}

export interface UzumOrdersResponse {
  data: UzumOrder[]
  totalCount: number
  page: number
  pageSize: number
}

// GET /v1/shops
export interface UzumShop {
  id: number
  name?: string
  title?: string
}

// One sellable SKU inside a product card (GET /v1/product/shop/{shopId})
export interface UzumSku {
  skuId: number
  skuTitle?: string
  productTitle?: string
  price: number              // current sell price, so'm
  purchasePrice: number      // cost / tannarx, so'm
  quantityActive?: number    // available stock
  quantityFbs?: number
  quantitySold?: number
  commission?: number
  article?: string
  sellerItemCode?: string
  barcode?: number
  // Per-SKU archived signals (a card can also be archived at the card level via
  // UzumProductCard.status). Any of these true → the sync marks the row archived.
  archived?: boolean
  status?: {
    value?: string
    title?: string
    description?: string
  }
}

export interface UzumProductCard {
  productId: number
  category?: string
  title?: string
  skuList: UzumSku[]
  // Authoritative product-level lifecycle status from Uzum. When
  // status.value === 'RUN_OUT' the seller cabinet shows "Закончился" /
  // "Tugadi" and the listing is not sellable — regardless of what the
  // quantityActive / quantityFbs numeric fields on the SKU say.
  status?: {
    value?: string
    title?: string
    description?: string
  }
}

export interface UzumShopProductsResponse {
  productList: UzumProductCard[]
  totalProductsAmount: number
}

// ─── Finance / expenses (GET /v1/finance/expenses) ───────────────────────────
// Uzum's authoritative record of money DEBITED from the seller — the same
// "Финансы → Расходы" screen. Ad/boost/promotion spend lands here as OUTCOME
// rows; there is no separate campaign endpoint on the seller-openapi tier, so
// this is the ONLY read that reveals real advertising cost. The exact `source`
// string Uzum uses for ads is not documented for us — lib/uzum/sync.ts logs
// every OUTCOME row so the real value is discoverable on the first live run.
export interface SellerPaymentDto {
  paymentPrice: number
  name: string
  source: string
  type: 'OUTCOME' | 'INCOME'
  status: string
  shopId: number
  dateService: string  // date-time
  dateCreated: string  // date-time
}

interface UzumExpensesResponse {
  payload?: { payments?: SellerPaymentDto[] }
  // tolerate a direct/alternate envelope
  payments?: SellerPaymentDto[]
  data?: { payments?: SellerPaymentDto[] }
}

// GET /v1/finance/expenses — shopIds repeated per id; dates are Unix epoch ms.
export async function fetchUzumExpenses(
  token: string,
  shopIds: number[],
  dateFromMs: number,
  dateToMs: number,
  page = 0,
  size = 100,
): Promise<{ payments: SellerPaymentDto[] }> {
  return withRetry(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    for (const id of shopIds) params.append('shopIds', String(id))
    params.set('dateFrom', String(dateFromMs))
    params.set('dateTo', String(dateToMs))
    return request<UzumExpensesResponse>(`/v1/finance/expenses?${params}`, token).then(r => ({
      payments: r.payload?.payments ?? r.payments ?? r.data?.payments ?? [],
    }))
  })
}

// Pull every page of /v1/finance/expenses for the given window.
export async function fetchAllUzumExpenses(
  token: string,
  shopIds: number[],
  dateFromMs: number,
  dateToMs: number,
  size = 100,
  maxPages = 20,
): Promise<SellerPaymentDto[]> {
  const out: SellerPaymentDto[] = []
  for (let page = 0; page < maxPages; page++) {
    const { payments } = await fetchUzumExpenses(token, shopIds, dateFromMs, dateToMs, page, size)
    out.push(...payments)
    if (payments.length < size) break
  }
  return out
}

// ─── API calls ────────────────────────────────────────────────────────────────

// ─── FBS Orders (GET /v2/fbs/orders) ─────────────────────────────────────────
// Swagger: GenericResponseSellerOrdersDto → payload.orders[]
// Required: shopIds (array of int64). dateFrom/dateTo = Unix epoch ms (int64)

export interface UzumFbsOrderItem {
  skuId: number
  productTitle?: string
  quantity?: number
  amount?: number // some payloads use `amount` for the unit count
  price: number
}

export interface UzumFbsOrder {
  id: string          // SellerOrderDto.id
  status: string
  dateCreated: string // ISO or epoch string
  price: number
  shopId?: number
  orderItems?: UzumFbsOrderItem[]
  // legacy aliases (keep for backward compat)
  orderId?: string
  createdAt?: string
  totalPrice?: number
  items?: UzumFbsOrderItem[]
}

export interface UzumFbsOrdersResponse {
  payload?: {
    orders?: UzumFbsOrder[]
    totalCount?: number
  }
  // fallback keys some versions return
  data?: UzumFbsOrder[]
  orders?: UzumFbsOrder[]
  totalCount?: number
}

// GET /v2/fbs/orders or /v2/fbo/orders — shopIds required; dates are Unix epoch ms
export async function fetchUzumOrders(
  token: string,
  shopIds: number[],
  page = 0,
  pageSize = 100,
  fromDateMs?: number,
  toDateMs?: number,
  orderType: 'fbs' | 'fbo' = 'fbs',
  status?: string,
): Promise<{ data: UzumFbsOrder[]; totalCount: number; pageSize: number }> {
  return withRetry(() => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    })
    for (const id of shopIds) params.append('shopIds', String(id))
    if (fromDateMs != null) params.set('dateFrom', String(fromDateMs))
    if (toDateMs != null) params.set('dateTo', String(toDateMs))
    if (status) params.set('status', status)
    return request<UzumFbsOrdersResponse>(`/v2/${orderType}/orders?${params}`, token).then(r => {
      const orders = r.payload?.orders ?? r.data ?? r.orders ?? []
      return {
        data: orders,
        totalCount: r.payload?.totalCount ?? r.totalCount ?? 0,
        pageSize,
      }
    })
  })
}

// GET /v1/finance/orders — real per-order-item financials (seller price,
// commission, delivery fee, seller profit, withdrawn profit). This is the
// canonical settlement view Uzum shows the seller on their "Финансы →
// Продажи" screen; we use it instead of estimating from Unit Economics
// percentages. Paginated; requires shopIds; dates are Unix epoch ms.
export interface UzumFinanceOrderItem {
  id: number
  status: 'TO_WITHDRAW' | 'PROCESSING' | 'CANCELED' | 'PARTIALLY_CANCELLED'
  date?: number         // unix epoch ms (transaction date)
  dateIssued?: number   // unix epoch ms
  orderId: number
  skuTitle?: string
  productId?: number
  shopId?: number
  productTitle?: string
  sellerPrice?: number         // per-item sell price, integer so'm
  amount?: number              // units in this line
  amountReturns?: number
  cancelled?: number
  commission?: number          // ACTUAL commission (not an estimate)
  sellerProfit?: number        // ACTUAL profit
  purchasePrice?: number
  logisticDeliveryFee?: number // ACTUAL delivery fee
  withdrawnProfit?: number     // net take-home after everything
  returnCause?: string
  comment?: string
}
// Uzum wraps most responses in the GenericResponse envelope
// { payload: {...}, errors, timestamp }, but some endpoints return the
// dto directly. Handle both — checked in this order:
//   r.orderItems (direct dto)
// | r.payload.orderItems (wrapped)
// | r.data.orderItems (some sandbox variants)
// | r.payload.data.orderItems (double-wrap seen on v1/finance/expenses)
interface RawFinanceResponse {
  orderItems?: UzumFinanceOrderItem[]
  totalElements?: number
  payload?: {
    orderItems?: UzumFinanceOrderItem[]
    totalElements?: number
    data?: { orderItems?: UzumFinanceOrderItem[]; totalElements?: number }
  }
  data?: { orderItems?: UzumFinanceOrderItem[]; totalElements?: number }
}
// All 4 statuses per Uzum's OpenAPI enum. Sent explicitly because the
// endpoint returned 0 items for a window the seller cabinet clearly
// showed orders in, which suggests the default (no statuses) filters
// EVERYTHING out rather than including all statuses.
const UZUM_FINANCE_STATUSES = ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED']

export async function fetchUzumFinanceOrders(
  token: string,
  shopIds: number[],
  page = 0,
  pageSize = 100,
  fromDateMs?: number,
  toDateMs?: number,
): Promise<{ items: UzumFinanceOrderItem[]; totalElements: number; rawShape?: string; probedUrl?: string }> {
  return withRetry(() => {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize), group: 'false' })
    for (const id of shopIds) params.append('shopIds', String(id))
    for (const s of UZUM_FINANCE_STATUSES) params.append('statuses', s)
    if (fromDateMs != null) params.set('dateFrom', String(fromDateMs))
    if (toDateMs != null)   params.set('dateTo',   String(toDateMs))
    const path = `/v1/finance/orders?${params}`
    return request<RawFinanceResponse>(path, token).then(r => {
      const items =
        r.orderItems
        ?? r.payload?.orderItems
        ?? r.data?.orderItems
        ?? r.payload?.data?.orderItems
        ?? []
      const totalElements =
        r.totalElements
        ?? r.payload?.totalElements
        ?? r.data?.totalElements
        ?? r.payload?.data?.totalElements
        ?? 0
      // When we come up empty, keep a compact snapshot of the top-level
      // keys + a 400-char JSON slice so the sync debug can prove the
      // shape wasn't a parse miss vs. a genuinely empty window.
      const rawShape = items.length === 0
        ? `keys=[${Object.keys(r ?? {}).join(',')}] body=${JSON.stringify(r).slice(0, 400)}`
        : undefined
      return { items, totalElements, rawShape, probedUrl: path }
    })
  })
}

// ─── OpenAPI spec (GET /swagger/api-docs) ────────────────────────────────────
// Proven readable with the seller token. Gives the AUTHORITATIVE status enum
// of GET /v2/fbs/orders' `status` parameter, replacing hand-maintained guesses
// (the guessed list of 6 missed real statuses like PACKING/PENDING_DELIVERY).
export async function fetchUzumFbsStatusEnum(token: string): Promise<string[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = await request<any>('/swagger/api-docs', token)
    if (!spec?.paths) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolve = (node: any): any => {
      if (node && typeof node === 'object' && typeof node.$ref === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cur: any = spec
        for (const part of node.$ref.replace(/^#\//, '').split('/')) cur = cur?.[part]
        return cur
      }
      return node
    }
    for (const [path, ops] of Object.entries(spec.paths)) {
      if (!/\/fbs\/orders\/?$/.test(path)) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const get = (ops as any)?.get
      for (const rawParam of get?.parameters ?? []) {
        const param = resolve(rawParam)
        if (param?.name !== 'status' && param?.name !== 'statuses') continue
        let schema = resolve(param.schema)
        if (schema?.type === 'array') schema = resolve(schema.items)
        if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
          return schema.enum.map(String)
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── FBS invoices (GET /v1/invoice) ──────────────────────────────────────────
// Proven readable (HTTP 200) on an account whose fresh orders are hidden from
// /v2/fbs/orders — a not-yet-shipped FBS order lives here. The response shape
// isn't documented for us, so parse tolerantly: return the first array found.
export async function fetchUzumInvoices(
  token: string,
  shopIds: number[],
  page = 0,
  size = 50,
): Promise<unknown[]> {
  return withRetry(async () => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    for (const id of shopIds) params.append('shopIds', String(id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = await request<any>(`/v1/invoice?${params}`, token)
    if (Array.isArray(j)) return j
    const direct = j?.payload?.invoices ?? j?.payload?.orders ?? j?.invoices ?? j?.data ?? j?.orders
      ?? (Array.isArray(j?.payload) ? j.payload : null)
    if (Array.isArray(direct)) return direct
    for (const v of Object.values(j?.payload ?? j ?? {})) {
      if (Array.isArray(v)) return v as unknown[]
    }
    return []
  })
}

// GET /v1/shops — the seller's own shops (we need the shopId for product calls)
export async function fetchUzumShops(token: string): Promise<UzumShop[]> {
  return withRetry(async () => {
    const data = await request<UzumShop[] | { shops?: UzumShop[]; data?: UzumShop[] }>('/v1/shops', token)
    if (Array.isArray(data)) return data
    return data.shops ?? data.data ?? []
  })
}

// GET /v1/product/shop/{shopId} — products + SKUs (stock, price, cost, sold)
// Tries every known filter value including inactive/archived so we capture
// quantitySold even for shops with 0 active listings.
export async function fetchUzumShopProducts(
  token: string,
  shopId: number,
  page = 0,
  size = 100,
): Promise<UzumShopProductsResponse> {
  const filtersToTry = ['ALL', 'ACTIVE', 'NOT_FOR_SALE', 'ARCHIVED', 'BLOCKED', undefined] as const
  let lastError: unknown

  for (const filter of filtersToTry) {
    try {
      return await withRetry(() => {
        const params = new URLSearchParams({
          page: String(page),
          size: String(size),
          sortBy: 'DEFAULT',
          order: 'ASC',
        })
        if (filter) params.set('filter', filter)
        return request<UzumShopProductsResponse>(`/v1/product/shop/${shopId}?${params}`, token)
      })
    } catch (e) {
      lastError = e
      // Only retry with next filter on 403 — other errors are not filter-related
      if (!(e instanceof UzumApiError && e.status === 403)) throw e
    }
  }
  throw lastError
}

// ─── Finance / Operations ────────────────────────────────────────────────────
// Uzum's seller dashboard shows real commission deductions in the "Финансы →
// Операции → Продажи" section. Discover finance endpoints from the swagger
// spec and try to call them to get per-order commission/fee data.

export interface UzumFinanceEntry {
  orderId: string
  commission: number
  delivery: number
  netPayout: number
}

export interface DiscoveredEndpoint {
  path: string
  methods: string[]
}

export async function discoverUzumFinancePaths(token: string): Promise<DiscoveredEndpoint[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = await request<any>('/swagger/api-docs', token)
    if (!spec?.paths) return []
    const keywords = /financ|balance|payment|payout|transaction|operation|settlement|accrual|report|earning|withdraw/i
    const results: DiscoveredEndpoint[] = []
    for (const [path, ops] of Object.entries(spec.paths)) {
      if (!keywords.test(path)) continue
      const methods = Object.keys(ops as object).filter(m => ['get', 'post'].includes(m))
      results.push({ path, methods: methods.length > 0 ? methods : ['get'] })
    }
    return results
  } catch {
    return []
  }
}

export async function fetchUzumFinanceData(
  token: string,
  shopIds: number[],
  discoveredEndpoints?: DiscoveredEndpoint[],
): Promise<{ entries: UzumFinanceEntry[]; balance: number | null; debug: Record<string, string> }> {
  const debug: Record<string, string> = {}
  const entries: UzumFinanceEntry[] = []
  let balance: number | null = null

  const buildParams = () => {
    const params = new URLSearchParams()
    for (const id of shopIds) params.append('shopIds', String(id))
    return params
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractBalance = (obj: any): number | null => {
    if (!obj || typeof obj !== 'object') return null
    for (const key of ['balance', 'totalBalance', 'availableBalance', 'currentBalance',
      'amount', 'totalAmount', 'earned', 'earnedAmount', 'sellerBalance']) {
      const v = obj[key] ?? obj.payload?.[key]
      if (typeof v === 'number' && v > 0) return v
    }
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tryExtract = (data: any, path: string) => {
    debug[`finance:${path}`] = JSON.stringify(data).slice(0, 600)
    const bal = extractBalance(data)
    if (bal != null) balance = bal

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] | null = Array.isArray(data) ? data
      : data?.payload?.operations ?? data?.payload?.transactions ?? data?.payload?.sales
      ?? data?.payload?.items ?? data?.payload?.entries ?? data?.payload?.list
      ?? data?.data ?? data?.operations ?? data?.transactions ?? data?.sales
      ?? data?.items ?? data?.entries ?? data?.list
      ?? (Array.isArray(data?.payload) ? data.payload : null)

    if (Array.isArray(items)) {
      for (const item of items) {
        const orderId = String(item.orderId ?? item.orderNumber ?? item.orderCode
          ?? item.order_id ?? item.id ?? '')
        if (!orderId || orderId === 'undefined') continue
        const commission = Math.abs(Number(
          item.commission ?? item.commissionAmount ?? item.fee ?? item.feeAmount
          ?? item.marketplaceFee ?? item.serviceFee ?? item.marketplace_fee
          ?? item.platformFee ?? item.uzumFee ?? 0
        ))
        const delivery = Math.abs(Number(
          item.deliveryCost ?? item.deliveryAmount ?? item.logistics ?? item.logisticsFee
          ?? item.logisticsAmount ?? item.delivery ?? item.delivery_cost ?? 0
        ))
        const netPayout = Number(
          item.netAmount ?? item.payout ?? item.payable ?? item.sellerAmount
          ?? item.amountForSeller ?? item.net ?? item.payoutAmount
          ?? item.sellerPayout ?? item.creditAmount ?? 0
        )
        if (commission > 0 || delivery > 0 || netPayout > 0) {
          entries.push({ orderId, commission, delivery, netPayout })
        }
      }
    }
  }

  const tryPath = async (path: string, methods: string[]) => {
    const key = `finance:${path}`
    if (debug[key]) return
    if (methods.includes('get')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await withRetry(() => request<any>(`${path}?${buildParams()}`, token), 1)
        tryExtract(data, path)
        return
      } catch (e) {
        const status = e instanceof UzumApiError ? e.status : 0
        debug[key] = e instanceof UzumApiError ? `GET ${e.status}` : `GET ${String(e).slice(0, 60)}`
        if (status !== 404 && status !== 405 && status !== 400) return
      }
    }
    if (methods.includes('post') || !methods.includes('get')) {
      try {
        const body: Record<string, unknown> = { page: 0, size: 100, shopIds }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await withRetry(() => request<any>(path, token, {
          method: 'POST', body: JSON.stringify(body),
        }), 1)
        tryExtract(data, path)
        debug[key] = (debug[key] ? debug[key] + ' | ' : '') + 'POST ok'
      } catch (e) {
        const postErr = e instanceof UzumApiError ? `POST ${e.status}` : `POST ${String(e).slice(0, 60)}`
        debug[key] = (debug[key] ? debug[key] + ' | ' : '') + postErr
      }
    }
  }

  // 1. Try discovered paths from swagger spec (with correct HTTP methods)
  const specEndpoints = discoveredEndpoints ?? []
  if (specEndpoints.length > 0) {
    debug.discoveredFinancePaths = specEndpoints.map(e => `${e.path}[${e.methods}]`).join(', ')
  }
  for (const ep of specEndpoints.slice(0, 8)) {
    await tryPath(ep.path, ep.methods)
    if (entries.length > 0) break
  }

  // 2. Try well-known Uzum seller API patterns (GET+POST each)
  if (entries.length === 0) {
    const fallbacks = [
      '/v1/finance/operations',
      '/v1/finance/balance',
      '/v2/finance/operations',
      '/v1/operation/list',
      '/v1/operation/sales',
      '/v1/seller/operations',
      '/v1/seller/finance',
      '/v1/seller/balance',
      '/v1/finance/transactions',
      '/v1/finance/sales',
      '/v1/report/sales',
      '/v1/finance/earning',
      '/v2/seller/finance',
    ]
    for (const path of fallbacks) {
      await tryPath(path, ['get', 'post'])
      if (entries.length > 0 || balance != null) break
    }
  }

  return { entries, balance, debug }
}

// ─── FBS SKU stocks (GET /v3/fbs/sku/stocks) — READ, requires SKU_READ ─────────
// The ONLY place the string barcode comes from. The write DTO and this read DTO
// both type `barcode` as a string; the product-card read types it as int64
// (drops leading zeros), so the barcode used for a write MUST be sourced here.
// Response shape isn't firmly documented for us — parse tolerantly.
export interface UzumSkuStock {
  barcode?: string | number
  skuId?: number
  sku?: string
  sellerSku?: string
  sellerSkuCode?: string
  sellerItemCode?: string
  article?: string
  productId?: number
  amount?: number
  quantityActive?: number
  fbsLinked?: boolean
}

export async function fetchUzumSkuStocks(
  token: string,
  page = 0,
  size = 100,
): Promise<UzumSkuStock[]> {
  return withRetry(async () => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = await request<any>(`/v3/fbs/sku/stocks?${params}`, token)
    const arr =
      // /v3/fbs/sku/stocks returns its rows under payload.skuAmountList — the
      // key the chain missed, so it fell through to [] and the identifier
      // backfill matched 0/N. Check it first, keep the others as fallbacks.
      j?.payload?.skuAmountList ?? j?.payload?.skuList ?? j?.payload?.stocks ?? j?.payload?.content
      ?? j?.skuList ?? j?.stocks ?? j?.data
      ?? (Array.isArray(j?.payload) ? j.payload : null)
      ?? (Array.isArray(j) ? j : [])
    return Array.isArray(arr) ? (arr as UzumSkuStock[]) : []
  })
}

// Fetch every page of /v3/fbs/sku/stocks (barcodes for a whole shop).
export async function fetchAllUzumSkuStocks(token: string, maxPages = 50): Promise<UzumSkuStock[]> {
  const out: UzumSkuStock[] = []
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchUzumSkuStocks(token, page, 100)
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out
}

// ─── Cheap order change-detector (GET /v2/fbs/orders/count) — READ ────────────
// Returns the count for a status (default CREATED) plus the rate-limit headers so
// the poller can honor them, including the daily cap X-RateLimit-Remaining-Per-Day.
export interface UzumOrdersCount {
  count: number | null
  rateLimitRemaining: number | null
  rateLimitRemainingPerDay: number | null
  retryAfterSec: number | null
  httpStatus: number
}

export async function fetchUzumOrdersCount(
  token: string,
  shopIds: number[],
  status = 'CREATED',
): Promise<UzumOrdersCount> {
  return withRetry(async () => {
    const params = new URLSearchParams({ status })
    for (const id of shopIds) params.append('shopIds', String(id))
    const res = await marketplaceFetch(`${UZUM_API_BASE}/v2/fbs/orders/count?${params}`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const remaining = Number(res.headers.get('X-RateLimit-Remaining'))
    const remainingDay = Number(res.headers.get('X-RateLimit-Remaining-Per-Day'))
    const retryAfter = Number(res.headers.get('Retry-After'))
    if (!res.ok) {
      throw new UzumApiError(res.status, `Uzum orders/count ${res.status}`, await res.text().catch(() => ''))
    }
    // Body is either a bare number or an envelope { payload: <number> }.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json().catch(() => null)
    const raw = typeof j === 'number' ? j : (j?.payload ?? j?.count ?? j?.data ?? null)
    const count = typeof raw === 'number' ? raw : (raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null)
    return {
      count,
      rateLimitRemaining: Number.isFinite(remaining) ? remaining : null,
      rateLimitRemainingPerDay: Number.isFinite(remainingDay) ? remainingDay : null,
      retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : null,
      httpStatus: res.status,
    }
  })
}

// Fetch all pages of a paginated resource
export async function fetchAllPages<T>(
  fetcher: (page: number) => Promise<{ data: T[]; totalCount: number; pageSize?: number }>,
  maxPages = 50,
): Promise<T[]> {
  const first = await fetcher(0)
  const results: T[] = [...first.data]
  const total = first.totalCount
  const size = first.pageSize ?? 100
  const pages = Math.min(Math.ceil(total / size), maxPages)
  for (let p = 1; p < pages; p++) {
    const res = await fetcher(p)
    results.push(...res.data)
  }
  return results
}
