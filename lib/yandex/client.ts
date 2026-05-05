// Yandex Market Partner API client
// Base URL: https://api.partner.market.yandex.ru
// Auth: OAuth token from partner.market.yandex.ru → Settings → API
// Docs: https://yandex.ru/dev/market/partner-api/doc/

export const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru'

export class YandexApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'YandexApiError'
  }
}

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${YANDEX_API_BASE}${path}`, {
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
    throw new YandexApiError(res.status, `Yandex API ${res.status} ${res.statusText} (${path})`)
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
  status: string           // CANCELLED, DELIVERED, DELIVERY, PENDING, PROCESSING, RETURNED
  createdAt: string
  updatedAt: string
  itemsTotal: number       // sum of item prices (RUB)
  buyerTotal: number       // what buyer paid (after delivery)
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

// Yandex Market catalog (for external market research)
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
  const data = await request<{ campaigns: YandexCampaign[] }>('/v2/campaigns', token)
  return data.campaigns ?? []
}

export async function fetchYandexOrders(
  token: string,
  campaignId: string,
  page = 1,
  pageSize = 50,
  fromDate?: string
): Promise<YandexOrdersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(fromDate ? { fromDate } : {}),
  })
  return request<YandexOrdersResponse>(`/v2/campaigns/${campaignId}/orders?${params}`, token)
}

export async function fetchYandexProducts(
  token: string,
  campaignId: string,
  pageToken?: string,
  limit = 200
): Promise<YandexOffersResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (pageToken) params.set('page_token', pageToken)
  return request<YandexOffersResponse>(
    `/v2/campaigns/${campaignId}/offer-mapping-entries?${params}`,
    token
  )
}

// External market research — categories from Yandex catalog
export async function fetchYandexCategories(token: string): Promise<YandexCategory[]> {
  try {
    const data = await request<{ categories: YandexCategory[] }>('/v2/categories/tree', token)
    return data.categories ?? []
  } catch {
    return []
  }
}

// External market research — top models in a category
export async function fetchCategoryModels(
  token: string,
  categoryId: number,
  count = 30,
  sort: 'OPINIONS' | 'PRICE' | 'QUALITY' = 'OPINIONS'
): Promise<YandexModel[]> {
  try {
    const params = new URLSearchParams({ count: String(count), sort, how: 'DESC', fields: 'PRICES,RATING,OFFERS_COUNT,REVIEW_COUNT' })
    const data = await request<{ models: YandexModel[] }>(
      `/v2/categories/${categoryId}/models?${params}`,
      token
    )
    return data.models ?? []
  } catch {
    return []
  }
}

// Fetch all pages of orders
export async function fetchAllYandexOrders(
  token: string,
  campaignId: string,
  fromDate?: string
): Promise<YandexOrder[]> {
  const first = await fetchYandexOrders(token, campaignId, 1, 50, fromDate)
  const all: YandexOrder[] = [...first.orders]
  const totalPages = first.pager.pagesCount
  for (let p = 2; p <= totalPages; p++) {
    const res = await fetchYandexOrders(token, campaignId, p, 50, fromDate)
    all.push(...res.orders)
  }
  return all
}

// Fetch all pages of products
export async function fetchAllYandexProducts(
  token: string,
  campaignId: string
): Promise<YandexOfferMappingEntry[]> {
  let pageToken: string | undefined
  const all: YandexOfferMappingEntry[] = []
  do {
    const res = await fetchYandexProducts(token, campaignId, pageToken)
    all.push(...res.result.offerMappingEntries)
    pageToken = res.result.paging?.nextPageToken
  } while (pageToken)
  return all
}
