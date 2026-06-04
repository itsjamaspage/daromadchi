// Uzum Market Seller API client
// Base URL: https://api-seller.uzum.uz/api/seller-openapi
// Auth: Bearer token from seller.uzum.uz → Settings → API
// Products: GET /v1/shops → shopId, then GET /v1/product/shop/{shopId}
// Swagger (requires login): https://api-seller.uzum.uz/api/seller-openapi/swagger/swagger-ui/webjars/swagger-ui/index.html

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

// Exponential backoff for transient errors (429, 5xx)
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseMs = 500): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err instanceof UzumApiError ? err.status : 0
      const retryable = status === 429 || status >= 500
      if (!retryable || attempt === retries) throw err
      await new Promise(r => setTimeout(r, baseMs * 2 ** attempt))
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
  const res = await fetch(`${UZUM_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: t,
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
  quantity: number
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

// GET /v2/fbs/orders — shopIds required; dates are Unix epoch ms
export async function fetchUzumOrders(
  token: string,
  shopIds: number[],
  page = 0,
  pageSize = 100,
  fromDateMs?: number,
  toDateMs?: number,
): Promise<{ data: UzumFbsOrder[]; totalCount: number; pageSize: number }> {
  return withRetry(() => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    })
    for (const id of shopIds) params.append('shopIds', String(id))
    if (fromDateMs != null) params.set('dateFrom', String(fromDateMs))
    if (toDateMs != null) params.set('dateTo', String(toDateMs))
    return request<UzumFbsOrdersResponse>(`/v2/fbs/orders?${params}`, token).then(r => {
      const orders = r.payload?.orders ?? r.data ?? r.orders ?? []
      return {
        data: orders,
        totalCount: r.payload?.totalCount ?? r.totalCount ?? 0,
        pageSize,
      }
    })
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
export async function fetchUzumShopProducts(
  token: string,
  shopId: number,
  page = 0,
  size = 100,
): Promise<UzumShopProductsResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
      sortBy: 'DEFAULT',
      order: 'ASC',
      filter: 'ALL',
    })
    return request<UzumShopProductsResponse>(`/v1/product/shop/${shopId}?${params}`, token)
  })
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
