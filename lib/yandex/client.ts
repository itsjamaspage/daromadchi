// Yandex Market Partner API client
// Base URL: https://api.partner.market.yandex.ru
// Auth: API key (header `Api-Key: <token>`) from partner.market.yandex.ru →
//   Settings → API → Authorization tokens. Yandex migrated off OAuth Bearer to
//   Api-Key; sending such a key as Bearer returns FORBIDDEN "OAuth token is invalid".
// Docs: https://yandex.ru/dev/market/partner-api/doc/

import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

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
  const res = await marketplaceFetch(`${YANDEX_API_BASE}${path}`, {
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
  // Some YM endpoints return price at the item level (flat), others nest it under prices
  price?: number
  buyerPrice?: number
  initialPrice?: number
  prices?: Array<{ type: string; costPerItem?: number; total?: number }>
}

export interface YandexOrder {
  id: number
  status: string // CANCELLED, DELIVERED, DELIVERY, PENDING, PROCESSING, RETURNED
  creationDate?: string  // "dd-MM-yyyy HH:mm:ss" — Yandex actual field name
  updatedAt?: string     // same format
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
  // Yandex renamed shopSku → offerId on newer offer-mappings responses.
  // Both may be present or empty depending on which endpoint answered.
  shopSku?: string
  offerId?: string
  name: string
  category: string
  vendor?: string
  // Prices can arrive under several field names across Yandex API versions.
  price?: { value: number; discountBase?: number }
  basicPrice?: { value: number | string; currencyId?: string; discountBase?: number }
  purchasePrice?: { value: number | string; currencyId?: string }
  cardPrice?: { value: number | string; currencyId?: string }
  marketSku?: number
  // Stock can appear inline on some offer-mappings responses (FBS sellers).
  stocks?: { type?: string; count?: number; warehouseId?: number }[]
  available?: boolean
  campaigns?: { campaignId?: number; status?: string; categoryId?: number }[]
}

export interface YandexOfferMappingEntry {
  offer: YandexOffer
  mapping?: { marketSku: number; marketSkuName: string; categoryId: number }
}

export interface YandexOffersResponse {
  result: {
    // v2 offer-mappings (current)
    offerMappings?: YandexOfferMappingEntry[]
    // v2 offer-mapping-entries (legacy, may still work on some campaigns)
    offerMappingEntries?: YandexOfferMappingEntry[]
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

// GET /v2/campaigns/{campaignId} — get campaign details including businessId
export async function fetchCampaignInfo(token: string, campaignId: string): Promise<{ businessId: number; campaign: YandexCampaign }> {
  const data = await request<{ campaign: YandexCampaign & { business?: { id: number } } }>(`/v2/campaigns/${campaignId}`, token)
  return { businessId: data.campaign.business?.id ?? 0, campaign: data.campaign }
}

export async function fetchYandexProducts(
  token: string,
  campaignId: string,
  pageToken?: string,
  limit = 200,
  businessId?: number,
): Promise<YandexOffersResponse> {
  return withRetry(async () => {
    // Yandex offer-mappings endpoints require POST — GET returns 405
    const body: Record<string, unknown> = { limit }
    if (pageToken) body.pageToken = pageToken
    const postOpts = { method: 'POST', body: JSON.stringify(body) }

    // 1. Business-level POST (bypasses campaign integration toggle)
    if (businessId) {
      try {
        return await request<YandexOffersResponse>(
          `/v2/businesses/${businessId}/offer-mappings`,
          token,
          postOpts,
        )
      } catch (e) {
        if (!(e instanceof YandexApiError && (e.status === 404 || e.status === 403 || e.status === 405))) throw e
      }
    }

    // 2. Campaign-level POST
    try {
      return await request<YandexOffersResponse>(
        `/v2/campaigns/${campaignId}/offer-mappings`,
        token,
        postOpts,
      )
    } catch (e) {
      if (!(e instanceof YandexApiError && (e.status === 404 || e.status === 405))) throw e
    }

    // 3. Legacy fallback (GET — older endpoint, kept as last resort)
    const params = new URLSearchParams({ limit: String(limit) })
    if (pageToken) params.set('page_token', pageToken)
    return request<YandexOffersResponse>(
      `/v2/campaigns/${campaignId}/offer-mapping-entries?${params}`,
      token,
    )
  })
}

// Prices from the dedicated offer-prices endpoint — used as fallback when
// offer-mappings doesn't include basicPrice for an offer. Read-only GET.
export interface YandexOfferPrice {
  offerId?: string          // shopSku
  marketSku?: string
  price?: { value: number; currencyId?: string; discountBase?: number }
  updatedAt?: string
}

export interface YandexOfferPricesResponse {
  result?: {
    offers?: YandexOfferPrice[]
    paging?: { nextPageToken?: string }
    total?: number
  }
}

export async function fetchYandexOfferPrices(
  token: string,
  campaignId: string,
  pageToken?: string,
): Promise<YandexOfferPricesResponse> {
  return withRetry(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (pageToken) params.set('page_token', pageToken)
    return request<YandexOfferPricesResponse>(
      `/v2/campaigns/${campaignId}/offer-prices?${params}`,
      token,
    )
  })
}

export async function fetchAllYandexOfferPrices(
  token: string,
  campaignId: string,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>()
  try {
    let pageToken: string | undefined
    do {
      const res = await fetchYandexOfferPrices(token, campaignId, pageToken)
      for (const o of res.result?.offers ?? []) {
        const key = o.offerId ?? (o.marketSku ? String(o.marketSku) : null)
        const val = o.price?.value
        if (key && typeof val === 'number' && val > 0) prices.set(key, val)
        // Also index by marketSku so we can look up when only marketSku is known.
        if (o.marketSku && typeof val === 'number' && val > 0) prices.set(String(o.marketSku), val)
      }
      pageToken = res.result?.paging?.nextPageToken
    } while (pageToken)
  } catch { /* best-effort */ }
  return prices
}

// Alternate stock source: POST /v2/campaigns/{campaignId}/offers returns
// per-offer info including the current available quantity. Useful when
// /offers/stocks returns empty (e.g. FBY-only sellers or sellers who haven't
// uploaded FBS stock yet).
export interface YandexCampaignOffer {
  offerId?: string
  marketSku?: number | string
  quantum?: { minQuantity?: number; stepQuantity?: number }
  available?: boolean
  stocks?: { type?: string; count?: number }[]
  status?: string
  campaignStatus?: string
}

export interface YandexCampaignOffersResponse {
  result?: {
    offers?: YandexCampaignOffer[]
    paging?: { nextPageToken?: string }
  }
}

export async function fetchAllYandexCampaignOffers(
  token: string,
  campaignId: string,
): Promise<Map<string, number>> {
  const stocks = new Map<string, number>()
  try {
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({ limit: '200' })
      if (pageToken) params.set('page_token', pageToken)
      const res = await withRetry(() => request<YandexCampaignOffersResponse>(
        `/v2/campaigns/${campaignId}/offers?${params}`,
        token,
        { method: 'POST', body: '{}' },
      ))
      for (const o of res.result?.offers ?? []) {
        const key = o.offerId ?? (o.marketSku ? String(o.marketSku) : null)
        if (!key) continue
        // Sum FIT (available) stocks across warehouses. Fall back to counting
        // any non-defect stock.
        let qty = 0
        for (const s of o.stocks ?? []) {
          if (!s?.count) continue
          if (!s.type || s.type === 'FIT' || s.type === 'AVAILABLE') qty += s.count
        }
        stocks.set(key, qty)
        if (o.marketSku) stocks.set(String(o.marketSku), qty)
      }
      pageToken = res.result?.paging?.nextPageToken
    } while (pageToken)
  } catch { /* best-effort */ }
  return stocks
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
    // Yandex expects the offer identifiers under `offerIds` (with the
    // withTurnover/archived flags), not `skus`. Sending {skus:[...]} was
    // returning HTTP 400 Bad Request. `offerIds:[]` requests stock for all
    // offers on the campaign.
    return request<YandexStocksResponse>(
      `/v2/campaigns/${campaignId}/offers/stocks?${params}`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          offerIds: skus.slice(0, 500),
          withTurnover: false,
          archived: false,
        }),
      },
    )
  })
}

// Fetch SKU-level sales stats for a date range
export async function fetchYandexSkuStats(
  token: string,
  campaignId: string,
  shopSkus: string[],
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
        body: JSON.stringify({ shopSkus, dateFrom, dateTo }),
      },
    )
  })
}

// Market research APIs — errors propagate so callers can surface them to the UI
export async function fetchYandexCategories(token: string): Promise<YandexCategory[]> {
  const data = await request<{ categories: YandexCategory[] }>('/v2/categories/tree', token)
  return data.categories ?? []
}

export async function fetchCategoryModels(
  token: string,
  categoryId: number,
  count = 30,
  sort: 'OPINIONS' | 'PRICE' | 'QUALITY' = 'OPINIONS',
): Promise<YandexModel[]> {
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
}

export async function searchYandexModels(
  token: string,
  query: string,
  count = 30,
  sort: 'OPINIONS' | 'PRICE' | 'QUALITY' = 'OPINIONS',
): Promise<YandexModel[]> {
  const params = new URLSearchParams({
    query,
    count: String(count),
    sort,
    how: 'DESC',
    fields: 'PRICES,RATING,OFFERS_COUNT,REVIEW_COUNT',
    regionId: '213', // Moscow region — broadest coverage
  })
  const data = await request<{ models: YandexModel[] }>(`/v2/models?${params}`, token)
  return data.models ?? []
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
  businessId?: number,
): Promise<YandexOfferMappingEntry[]> {
  let pageToken: string | undefined
  const all: YandexOfferMappingEntry[] = []
  do {
    const res = await withRetry(() => fetchYandexProducts(token, campaignId, pageToken, 200, businessId))
    const entries = res.result.offerMappings ?? res.result.offerMappingEntries ?? []
    all.push(...entries)
    pageToken = res.result.paging?.nextPageToken
  } while (pageToken)
  return all
}

// Fetch stocks for all SKUs in batches of 500. Also returns the last HTTP
// error status if one occurred, so the sync can distinguish "endpoint said
// 0 items" from "endpoint returned 403/500".
export async function fetchAllYandexStocks(
  token: string,
  campaignId: string,
  skus: string[],
): Promise<{ stockMap: Map<string, number>; lastError: string | null }> {
  const stockMap = new Map<string, number>()
  let lastError: string | null = null
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
    } catch (e) {
      // Preserve the last error so the sync can surface it as `stocksErr=403`
      // (or the truncated message body) instead of silently reporting stocks=0.
      if (e instanceof YandexApiError) {
        const bodySnippet = e.body ? ` ${e.body.slice(0, 120)}` : ''
        lastError = `${e.status}${bodySnippet}`
      } else {
        lastError = 'err'
      }
    }
  }
  return { stockMap, lastError }
}

// Fetch SKU stats for a period (best-effort)
export async function fetchAllYandexSkuStats(
  token: string,
  campaignId: string,
  shopSkus: string[],
  dateFrom: string,
  dateTo: string,
): Promise<YandexSkuStat[]> {
  if (shopSkus.length === 0) return []
  const all: YandexSkuStat[] = []
  try {
    let pageToken: string | undefined
    do {
      const res = await fetchYandexSkuStats(token, campaignId, shopSkus, dateFrom, dateTo, pageToken)
      all.push(...res.result.shopSkus)
      pageToken = res.result.paging?.nextPageToken
    } while (pageToken)
  } catch {
    // Optional — graceful skip
  }
  return all
}
