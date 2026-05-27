// Uzum Seller API client
// Base URL: https://api-seller.uzum.uz/api/seller-openapi
// Auth: Authorization: {token}  — NO "Bearer " prefix per Uzum spec
// Swagger: https://api-seller.uzum.uz/api/seller-openapi/swagger/swagger-ui/...

export const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi'

export class UzumApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'UzumApiError'
  }
}

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${UZUM_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new UzumApiError(res.status, `Uzum API error: ${res.status} ${res.statusText} (${path})`)
  }

  return res.json() as Promise<T>
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface OrganizationDto {
  id: number
  name: string
}

export interface SkuForTable {
  skuId: number
  price?: number           // selling price
  purchasePrice?: number   // cost price
  quantityActive?: number  // FBO stock
  quantityFbs?: number     // FBS stock
  commission?: number
  dimensionalGroup?: 'SMALL' | 'MEDIUM' | 'LARGE' | string
}

export interface SellerProductCard {
  productId: number
  title?: string
  category?: string
  commissionDto?: { minCommission: number; maxCommission: number }
  skuList?: SkuForTable[]
}

export interface AllProducts {
  productList: SellerProductCard[]
  totalProductsAmount: number
}

export interface SellerOrderItemDto {
  id: number
  status: 'TO_WITHDRAW' | 'PROCESSING' | 'CANCELED' | 'PARTIALLY_CANCELLED'
  date: number              // Unix ms
  orderId: number
  skuTitle?: string
  productTitle?: string
  productId: number
  shopId: number
  sellerPrice: number       // revenue per item
  amount: number            // quantity sold
  amountReturns: number
  commission: number        // marketplace commission
  sellerProfit: number      // profit after all fees
  purchasePrice: number     // cost price
  logisticDeliveryFee: number
  withdrawnProfit: number
  cancelled: number
}

export interface FinanceOrderItemsDto {
  orderItems: SellerOrderItemDto[]
  totalElements: number
}

export interface SkuAmountApiResponseDto {
  skuId: number
  skuTitle?: string
  productTitle?: string
  barcode?: string
  amount: number            // FBS stock quantity
  fbsAllowed?: boolean
  dbsAllowed?: boolean
}

export interface StocksResponse {
  payload?: { skuAmountList: SkuAmountApiResponseDto[] }
  errors?: unknown[]
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchUzumShops(token: string): Promise<OrganizationDto[]> {
  return request<OrganizationDto[]>('/v1/shops', token)
}

export async function fetchUzumProducts(
  token: string,
  shopId: number,
  page = 0,
  size = 50,
): Promise<AllProducts> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  return request<AllProducts>(`/v1/product/shop/${shopId}?${params}`, token)
}

export interface FinanceOrdersOptions {
  shopId: number
  dateFrom: number   // Unix ms
  dateTo: number     // Unix ms
  page?: number
  size?: number
  group?: boolean
}

export async function fetchUzumFinanceOrders(
  token: string,
  opts: FinanceOrdersOptions,
): Promise<FinanceOrderItemsDto> {
  const params = new URLSearchParams({
    shopIds: String(opts.shopId),
    dateFrom: String(opts.dateFrom),
    dateTo:   String(opts.dateTo),
    page:     String(opts.page ?? 0),
    size:     String(opts.size ?? 200),
    group:    String(opts.group ?? false),
  })
  return request<FinanceOrderItemsDto>(`/v1/finance/orders?${params}`, token)
}

export async function fetchUzumStocks(token: string): Promise<StocksResponse> {
  return request<StocksResponse>('/v2/fbs/sku/stocks', token)
}

// Paginate products across all pages
export async function fetchAllUzumProducts(
  token: string,
  shopId: number,
  pageSize = 50,
): Promise<SellerProductCard[]> {
  const first = await fetchUzumProducts(token, shopId, 0, pageSize)
  const results: SellerProductCard[] = [...first.productList]
  const totalPages = Math.ceil(first.totalProductsAmount / pageSize)
  for (let p = 1; p < totalPages; p++) {
    const res = await fetchUzumProducts(token, shopId, p, pageSize)
    results.push(...res.productList)
  }
  return results
}

// Paginate finance orders across all pages
export async function fetchAllUzumFinanceOrders(
  token: string,
  opts: Omit<FinanceOrdersOptions, 'page'>,
  pageSize = 200,
): Promise<SellerOrderItemDto[]> {
  const first = await fetchUzumFinanceOrders(token, { ...opts, page: 0, size: pageSize })
  const results: SellerOrderItemDto[] = [...first.orderItems]
  const totalPages = Math.ceil(first.totalElements / pageSize)
  for (let p = 1; p < totalPages; p++) {
    const res = await fetchUzumFinanceOrders(token, { ...opts, page: p, size: pageSize })
    results.push(...res.orderItems)
  }
  return results
}
