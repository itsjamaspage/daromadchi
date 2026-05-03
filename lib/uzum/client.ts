// Uzum Market Seller API client
// Base URL: https://api-seller.uzum.uz/api
// Auth: Bearer token from seller.uzum.uz → Settings → API
// Swagger (requires login): https://api-seller.uzum.uz/api/seller-openapi/swagger/swagger-ui/webjars/swagger-ui/index.html

export const UZUM_API_BASE = 'https://api-seller.uzum.uz/api'

export class UzumApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'UzumApiError'
  }
}

async function request<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${UZUM_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new UzumApiError(res.status, `Uzum API error: ${res.status} ${res.statusText} (${path})`)
  }

  return res.json() as Promise<T>
}

// ─── Response shapes (update if Uzum changes their schema) ──────────────────

export interface UzumOrderItem {
  productId: number
  productName: string
  quantity: number
  price: number        // unit price in so'm
}

export interface UzumOrder {
  orderId: string
  orderNumber: string  // e.g. UZM-001842
  customerName: string
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  createdAt: string    // ISO date
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
  purchasePrice: number  // cost / tannarx
  stock: number
}

export interface UzumProductsResponse {
  data: UzumProduct[]
  totalCount: number
  page: number
  pageSize: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchUzumOrders(
  token: string,
  page = 0,
  pageSize = 100,
  fromDate?: string
): Promise<UzumOrdersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(pageSize),
    ...(fromDate ? { dateFrom: fromDate } : {}),
  })
  return request<UzumOrdersResponse>(`/v1/orders?${params}`, token)
}

export async function fetchUzumProducts(
  token: string,
  page = 0,
  pageSize = 100
): Promise<UzumProductsResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
  return request<UzumProductsResponse>(`/v1/products?${params}`, token)
}

// Fetch all pages of a resource
export async function fetchAllPages<T>(
  fetcher: (page: number) => Promise<{ data: T[]; totalCount: number; pageSize: number }>
): Promise<T[]> {
  const first = await fetcher(0)
  const results: T[] = [...first.data]
  const total = first.totalCount
  const size  = first.pageSize || 100

  const pages = Math.ceil(total / size)
  for (let p = 1; p < pages; p++) {
    const res = await fetcher(p)
    results.push(...res.data)
  }
  return results
}
