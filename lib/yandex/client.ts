// Yandex Market Partner API client
// Base URL: https://api.partner.market.yandex.ru
// Auth: API key (header `Api-Key: <token>`) from partner.market.yandex.ru →
//   Settings → API → Authorization tokens. Yandex migrated off OAuth Bearer to
//   Api-Key; sending such a key as Bearer returns FORBIDDEN "OAuth token is invalid".
// Docs: https://yandex.ru/dev/market/partner-api/doc/

export const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru'

export class YandexApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: string,
  ) {
    super(message)
    this.name = 'YandexApiError'
  }
}

// Exponential backoff for transient errors (429, 5xx)
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseMs = 600): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err instanceof YandexApiError ? err.status : 0
      const retryable = status === 429 || status >= 500
      if (!retryable || attempt === retries) throw err
      await new Promise(r => setTimeout(r, baseMs * 2 ** attempt))
    }
  }
  throw new Error('unreachable')
}

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${YANDEX_API_BASE}${path}`, {
    ...options,
    headers: {
      'Api-Key': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new YandexApiError(
      res.status,
      `Yandex API ${res.status} ${res.statusText} (${path})`,
      body,
    )
  }
  return res.json() as Promise<T>
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface YandexCampaign {
  id: number
  domain: string
  state: { status: string }
}

export interface YandexOrderItem {
  offerId: string
  offerName: string
  count: number
  prices: { buyerPriceBeforeDiscount: number; buyerPrice: number }
}

export interface YandexOrder {
  id: number
  status: string // CANCELLED, DELIVERED, DELIVERY, PENDING, PROCESSING, RETURNED
  createdAt: string
  updatedAt: string
  itemsTotal: number
  buyerTotal: number
  deliveryTotal: number
  commissionTotal?: number
  items: YandexOrderItem[]
}

export interface YandexOrdersResponse {
  orders: YandexOrder[]
  pager: { total: number; currentPage: number; pagesCount: number; pageSize: number }
}

export interface YandexOffer {
  shopSku: string
  name: string
  category: string
  vendor?: string
  price?: { value: number; discountBase?: number }
  marketSku?: number
}

export interface YandexOfferMappingEntry {
  offer: YandexOffer
  mapping?: { marketSku: number; marketSkuName: string; categoryId: number }
}

export interface YandexOffersResponse {
  result: {
    offerMappingEntries: YandexOfferMappingEntry[]
    paging?: { nextPageToken?: string }
  }
}

// Warehouse stocks response (FBS sellers)
export interface YandexWarehouseStock {
  sku: string
  warehouseStocks: { type: 'FIT' | 'DEFECT' | 'EXPIRED' | string; count: number }[]
}

export interface YandexStocksResponse {
  result: {
    skus: YandexWarehouseStock[]
    nextPageToken?: string
  }
}

// SKU-level sales stats
export interface YandexSkuStat {
  shopSku: string
  marketSku?: number
  name?: string
  ordersCount: number
  orderedAmount: number
  shippedAmount: number
  cancelledAmount: number
  grossRevenue: number
  commissionRevenue: number
}

export interface YandexSkuStatsResponse {
  result: {
    shopSkus: YandexSkuStat[]
    paging?: { nextPageToken?: string }
  }
}

// Market research types
export interface YandexCategory {
  id: number
  name: string
  childCount: number
  adult?: boolean
}

export interface YandexModel {
  id: number
  name: string
  prices?: { min: number; max: number; avg: number; cur: string }
  rating?: number
  reviewCount?: number
  offersCount?: number
  categoryId?: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchCampaigns(token: string): Promise<YandexCampaign[]> {
  return withRetry(async () => {
    const data = await request<{ campaigns: YandexCampaign[] }>('/v2/campaigns', token)
    return data.campaigns ?? []
  })
}

export async function fetchYandexOrders(
  token: string,
  campaignId: string,
  page = 1,
  pageSize = 50,
  fromDate?: string,
): Promise<YandexOrdersResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(fromDate ? { fromDate } : {}),
    })
    return request<YandexOrdersResponse>(`/v2/campaigns/${campaignId}/orders?${params}`, token)
  })
}

export async function fetchYandexProducts(
  token: string,
  campaignId: string,
  pageToken?: string,
  limit = 200,
): Promise<YandexOffersResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (pageToken) params.set('page_token', pageToken)
    return request<YandexOffersResponse>(
      `/v2/campaigns/${campaignId}/offer-mapping-entries?${params}`,
      token,
    )
  })
}

// Fetch FBS warehouse stocks for given SKUs (batch up to 500 per request)
export async function fetchYandexStocks(
  token: string,
  campaignId: string,
  skus: string[],
  pageToken?: string,
): Promise<YandexStocksResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({ limit: '500' })
    if (pageToken) params.set('page_token', pageToken)
    return request<YandexStocksResponse>(
      `/v2/campaigns/${campaignId}/offers/stocks?${params}`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ skus: skus.slice(0, 500) }),
      },
    )
  })
}

// Fetch SKU-level sales stats for a date range
export async function fetchYandexSkuStats(
  token: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
  pageToken?: string,
): Promise<YandexSkuStatsResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({ limit: '500' })
    if (pageToken) params.set('page_token', pageToken)
    return request<YandexSkuStatsResponse>(
      `/v2/campaigns/${campaignId}/stats/skus?${params}`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ dateFrom, dateTo }),
      },
    )
  })
}

// Market research APIs (no auth required beyond campaign access)
export async function fetchYandexCategories(token: string): Promise<YandexCategory[]> {
  try {
    const data = await request<{ categories: YandexCategory[] }>('/v2/categories/tree', token)
    return data.categories ?? []
  } catch {
    return []
  }
}

export async function fetchCategoryModels(
  token: string,
  categoryId: number,
  count = 30,
  sort: 'OPINIONS' | 'PRICE' | 'QUALITY' = 'OPINIONS',
): Promise<YandexModel[]> {
  try {
    const params = new URLSearchParams({
      count: String(count),
      sort,
      how: 'DESC',
      fields: 'PRICES,RATING,OFFERS_COUNT,REVIEW_COUNT',
    })
    const data = await request<{ models: YandexModel[] }>(
      `/v2/categories/${categoryId}/models?${params}`,
      token,
    )
    return data.models ?? []
  } catch {
    return []
  }
}

// Pagination helpers
export async function fetchAllYandexOrders(
  token: string,
  campaignId: string,
  fromDate?: string,
): Promise<YandexOrder[]> {
  return withRetry(async () => {
    const first = await fetchYandexOrders(token, campaignId, 1, 50, fromDate)
    const all: YandexOrder[] = [...first.orders]
    const totalPages = first.pager.pagesCount
    for (let p = 2; p <= totalPages; p++) {
      const res = await fetchYandexOrders(token, campaignId, p, 50, fromDate)
      all.push(...res.orders)
    }
    return all
  })
}

export async function fetchAllYandexProducts(
  token: string,
  campaignId: string,
): Promise<YandexOfferMappingEntry[]> {
  let pageToken: string | undefined
  const all: YandexOfferMappingEntry[] = []
  do {
    const res = await withRetry(() => fetchYandexProducts(token, campaignId, pageToken))
    all.push(...res.result.offerMappingEntries)
    pageToken = res.result.paging?.nextPageToken
  } while (pageToken)
  return all
}

// Fetch stocks for all SKUs in batches of 500
export async function fetchAllYandexStocks(
  token: string,
  campaignId: string,
  skus: string[],
): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>()
  for (let i = 0; i < skus.length; i += 500) {
    const batch = skus.slice(i, i + 500)
    try {
      let pageToken: string | undefined
      do {
        const res = await fetchYandexStocks(token, campaignId, batch, pageToken)
        for (const item of res.result.skus) {
          const fit = item.warehouseStocks.find(s => s.type === 'FIT')
          stockMap.set(item.sku, (stockMap.get(item.sku) ?? 0) + (fit?.count ?? 0))
        }
        pageToken = res.result.nextPageToken
      } while (pageToken)
    } catch {
      // Stock sync is best-effort per batch
    }
  }
  return stockMap
}

// Fetch SKU stats for a period (best-effort)
export async function fetchAllYandexSkuStats(
  token: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<YandexSkuStat[]> {
  const all: YandexSkuStat[] = []
  try {
    let pageToken: string | undefined
    do {
      const res = await fetchYandexSkuStats(token, campaignId, dateFrom, dateTo, pageToken)
      all.push(...res.result.shopSkus)
      pageToken = res.result.paging?.nextPageToken
    } while (pageToken)
  } catch {
    // Optional — graceful skip
  }
  return all
}
