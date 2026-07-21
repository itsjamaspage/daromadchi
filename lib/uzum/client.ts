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
}

export interface UzumProductCard {
  productId: number
  category?: string
  title?: string
  skuList: UzumSku[]
}

export interface UzumShopProductsResponse {
  productList: UzumProductCard[]
  totalProductsAmount: number
}

export interface UzumAdCampaign {
  campaignId: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'COMPLETED'
  type: 'CPC' | 'CPO' | 'SEARCH_PROMO'
  totalBudget: number
  spentBudget: number
  startDate: string
  endDate?: string
  productId?: number
  productName?: string
  clicks?: number
  impressions?: number
  orders?: number
  revenue?: number
}

export interface UzumAdCampaignsResponse {
  data: UzumAdCampaign[]
  totalCount: number
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

export async function fetchUzumAdCampaigns(
  token: string,
  page = 0,
  pageSize = 100,
): Promise<UzumAdCampaignsResponse> {
  return withRetry(async () => {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    // Try the most common Uzum campaign endpoint patterns
    try {
      return await request<UzumAdCampaignsResponse>(`/v1/campaign/campaigns?${params}`, token)
    } catch (e1) {
      if (e1 instanceof UzumApiError && e1.status === 404) {
        try {
          return await request<UzumAdCampaignsResponse>(`/v1/promotion/campaigns?${params}`, token)
        } catch (e2) {
          if (e2 instanceof UzumApiError && e2.status === 404) {
            return { data: [], totalCount: 0 } // ads not available on this account tier
          }
          throw e2
        }
      }
      throw e1
    }
  })
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

export async function discoverUzumFinancePaths(token: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = await request<any>('/swagger/api-docs', token)
    if (!spec?.paths) return []
    const keywords = /financ|balance|payment|payout|transaction|operation|settlement|accrual|report/i
    return Object.keys(spec.paths).filter(p => keywords.test(p))
  } catch {
    return []
  }
}

export async function fetchUzumFinanceData(
  token: string,
  shopIds: number[],
  discoveredPaths?: string[],
): Promise<{ entries: UzumFinanceEntry[]; balance: number | null; debug: Record<string, string> }> {
  const debug: Record<string, string> = {}
  const entries: UzumFinanceEntry[] = []
  let balance: number | null = null

  const buildParams = (extra?: Record<string, string>) => {
    const params = new URLSearchParams({ page: '0', size: '100', ...extra })
    for (const id of shopIds) params.append('shopIds', String(id))
    return params
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tryExtract = (data: any, path: string) => {
    debug[`finance:${path}`] = JSON.stringify(data).slice(0, 600)
    // Look for balance
    const bal = data?.balance ?? data?.payload?.balance ?? data?.totalBalance
      ?? data?.payload?.totalBalance ?? data?.availableBalance ?? data?.payload?.availableBalance
    if (typeof bal === 'number' && bal > 0) balance = bal

    // Look for per-operation entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] | null = Array.isArray(data) ? data
      : data?.payload?.operations ?? data?.payload?.transactions ?? data?.payload?.sales
      ?? data?.data ?? data?.operations ?? data?.transactions ?? data?.sales
      ?? (Array.isArray(data?.payload) ? data.payload : null)

    if (Array.isArray(items)) {
      for (const item of items) {
        const orderId = String(item.orderId ?? item.orderNumber ?? item.orderCode
          ?? item.order_id ?? item.id ?? '')
        if (!orderId || orderId === 'undefined') continue
        const commission = Math.abs(Number(
          item.commission ?? item.fee ?? item.marketplaceFee ?? item.serviceFee
          ?? item.commissionAmount ?? item.marketplace_fee ?? 0
        ))
        const delivery = Math.abs(Number(
          item.deliveryCost ?? item.logistics ?? item.logisticsFee
          ?? item.delivery ?? item.delivery_cost ?? 0
        ))
        const netPayout = Number(
          item.netAmount ?? item.payout ?? item.payable ?? item.sellerAmount
          ?? item.amountForSeller ?? item.net ?? item.amount ?? 0
        )
        if (commission > 0 || delivery > 0 || netPayout > 0) {
          entries.push({ orderId, commission, delivery, netPayout })
        }
      }
    }
  }

  // 1. Try discovered paths from swagger spec
  const specPaths = discoveredPaths ?? []
  if (specPaths.length > 0) debug.discoveredFinancePaths = specPaths.join(', ')
  for (const path of specPaths.slice(0, 6)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await withRetry(() => request<any>(`${path}?${buildParams()}`, token), 1)
      tryExtract(data, path)
    } catch (e) {
      debug[`finance:${path}`] = e instanceof UzumApiError ? `HTTP ${e.status}` : String(e).slice(0, 80)
    }
  }

  // 2. Try well-known patterns not in spec
  const fallbacks = [
    '/v1/finance/balance',
    '/v1/finance/operations',
    '/v1/finance/transactions',
    '/v1/finance/sales',
    '/v1/seller/finance/operations',
    '/v1/seller/balance',
  ]
  for (const path of fallbacks) {
    if (debug[`finance:${path}`]) continue
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await withRetry(() => request<any>(`${path}?${buildParams()}`, token), 1)
      tryExtract(data, path)
      if (entries.length > 0 || balance != null) break
    } catch (e) {
      debug[`finance:${path}`] = e instanceof UzumApiError ? `HTTP ${e.status}` : String(e).slice(0, 80)
    }
  }

  return { entries, balance, debug }
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
