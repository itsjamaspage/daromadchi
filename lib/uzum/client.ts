// Uzum Market Seller API client
// Base URL: https://api-seller.uzum.uz/api
// Auth: Bearer token from seller.uzum.uz → Settings → API
// Swagger (requires login): https://api-seller.uzum.uz/api/seller-openapi/swagger/swagger-ui/webjars/swagger-ui/index.html

export const UZUM_API_BASE = 'https://api-seller.uzum.uz/api'

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

async function request<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${UZUM_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new UzumApiError(
      res.status,
      `Uzum API error: ${res.status} ${res.statusText} (${path})`,
      body,
    )
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

export interface UzumProduct {
  productId: number
  name: string
  sku: string
  categoryName: string
  price: number
  purchasePrice: number // cost / tannarx
  stock: number
}

export interface UzumProductsResponse {
  data: UzumProduct[]
  totalCount: number
  page: number
  pageSize: number
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

export async function fetchUzumOrders(
  token: string,
  page = 0,
  pageSize = 100,
  fromDate?: string,
): Promise<UzumOrdersResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
      ...(fromDate ? { dateFrom: fromDate } : {}),
    })
    return request<UzumOrdersResponse>(`/v1/orders?${params}`, token)
  })
}

export async function fetchUzumProducts(
  token: string,
  page = 0,
  pageSize = 100,
): Promise<UzumProductsResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    return request<UzumProductsResponse>(`/v1/products?${params}`, token)
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
