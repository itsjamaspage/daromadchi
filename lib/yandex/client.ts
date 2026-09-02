// Yandex Market Partner API client
// Base URL: https://api.partner.market.yandex.ru
// Auth: API key (header `Api-Key: <token>`) from partner.market.yandex.ru →
//   Settings → API → Authorization tokens. Yandex migrated off OAuth Bearer to
//   Api-Key; sending such a key as Bearer returns FORBIDDEN "OAuth token is invalid".
// Docs: https://yandex.ru/dev/market/partner-api/doc/

import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { resolveColor } from '@/lib/products/resolveColor'

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
    // Server-side log so the real error text (401/403 permissions, 400 bad
    // param, 429 quota) shows up in pm2 logs even when the caller collapses
    // the failure into a `debug.<field>=err` badge for the UI.
    console.error(`[Yandex API] ${res.status} ${res.statusText} — ${path}\n${body.slice(0, 500)}`)
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
  // Yandex reports the campaign's fulfillment model here. Values seen in
  // practice: 'FBS', 'FBY', 'DBS', 'CLICK_AND_COLLECT', 'EXPRESS'.
  placementType?: string
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
  // Detail within `status` — e.g. PROCESSING/STARTED (confirmed, start packing)
  // vs PROCESSING/SHIPPED (already handed over), or CANCELLED/USER_NOT_PAID.
  // REQUIRED on Yandex's OrderDTO; optional here only so fixtures and older
  // captured payloads still type-check. Read by the new-order alert gate
  // (lib/marketplace/fulfillment-statuses.ts); NOT persisted — see the
  // parking-lot item in docs/investigations/order-cancellation-sync-findings.md.
  substatus?: string
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
  // Category may arrive under several field names depending on API version.
  category?: string
  categoryName?: string
  marketCategoryName?: string
  vendor?: string
  // Prices can arrive under several field names across Yandex API versions.
  price?: { value: number; discountBase?: number }
  basicPrice?: { value: number | string; currencyId?: string; discountBase?: number }
  purchasePrice?: { value: number | string; currencyId?: string }
  cardPrice?: { value: number | string; currencyId?: string }
  marketSku?: number
  // Stock can appear inline on some offer-mappings responses (FBS sellers).
  stocks?: { type?: string; count?: number; warehouseId?: number }[]
  pictures?: string[]
  available?: boolean
  campaigns?: { campaignId?: number; status?: string; categoryId?: number }[]
}

export interface YandexOfferMappingEntry {
  offer: YandexOffer
  mapping?: {
    marketSku: number
    marketSkuName?: string
    marketCategoryName?: string
    marketModelName?: string
    categoryId?: number
    categoryName?: string
  }
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

// Warehouse stocks response (FBS sellers). Yandex has two response shapes
// depending on API version: `result.skus[]` (older) and `result.warehouses[]`
// nested with per-warehouse offers (newer). We accept either.
export interface YandexWarehouseStock {
  sku?: string
  offerId?: string
  warehouseStocks?: { type?: string; count?: number }[]
  stocks?: { type?: string; count?: number }[]
}

export interface YandexWarehouseWithOffers {
  warehouseId?: number
  offers?: {
    offerId?: string
    stocks?: { type?: string; count?: number }[]
    turnoverSummary?: unknown
  }[]
}

export interface YandexStocksResponse {
  result: {
    skus?: YandexWarehouseStock[]
    warehouses?: YandexWarehouseWithOffers[]
    nextPageToken?: string
    paging?: { nextPageToken?: string }
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

/**
 * Units actually FREE TO SELL from a Yandex stocks array.
 *
 * Verified against the official spec (WarehouseStockType):
 *   FIT    — «доступный для продажи ИЛИ УЖЕ ЗАРЕЗЕРВИРОВАН»  (available + reserved)
 *   FREEZE — «зарезервирован для заказов»                     (reserved)
 *
 * We WRITE free-to-sell: UpdateStockItemDTO carries only `count`, documented as
 * «Количество доступного товара», and has no type field at all. Reading FIT back
 * therefore compared a written free-to-sell against an on-hand, which differ by
 * exactly the reserve for as long as an order is open — so the diff could never
 * close and the writer re-pushed the same value forever (#393).
 *
 * FIT − FREEZE rather than AVAILABLE: earlier work found AVAILABLE unreliable on
 * these endpoints (it reflected campaign-level flags and showed phantom stock
 * where YM's own UI said «Нет на складе»). This keeps to the field that was
 * trusted and subtracts the reserve explicitly. With no FREEZE entry the result
 * is identical to the previous behaviour.
 */
export function yandexSellableStock(stocks: { type?: string; count?: number }[] | undefined): number {
  const list = stocks ?? []
  const fit = list.find(s => s?.type === 'FIT')?.count ?? 0
  const freeze = list.find(s => s?.type === 'FREEZE')?.count ?? 0
  return Math.max(0, fit - freeze)
}

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
        // Only trust FIT — YM's own catalog UI does the same. On this
        // endpoint, AVAILABLE / list[0] are not physical sellable inventory
        // (they reflect campaign-level flags or reserved/frozen units), so
        // falling through to them makes daromadchi show phantom stock when
        // YM's UI correctly shows "Нет на складе".
        const qty = yandexSellableStock(o.stocks)
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
  return withRetry(async () => {
    // Yandex caps this endpoint at 200 items per page; higher values return
    // 400 "Parameter limit must be less than or equal to 200".
    const params = new URLSearchParams({ limit: '200' })
    if (pageToken) params.set('page_token', pageToken)
    const url = `/v2/campaigns/${campaignId}/offers/stocks?${params}`
    // Yandex's endpoint has accepted different body shapes across versions.
    // Order matters: put the KNOWN-WORKING shape first so we stop
    // burning a 400 request on every sync (visible on the seller's
    // Yandex API log — this endpoint was showing 50% error rate purely
    // because the previous order 400'd on attempt 1 and succeeded on
    // attempt 2). Empty body returns the paginated list of all offers,
    // which for typical shops is already covered by the limit=200 query
    // param.
    //
    // withTurnover/archived were valid on /v2/campaigns/{id}/offers
    // (the catalog endpoint) but not on /offers/stocks — sending them
    // here triggers a schema-mismatch 400.
    const attempts: Array<{ body: object; label: string }> = [
      { body: {},                                     label: 'empty' },
      { body: { offerIds: skus.slice(0, 200) },       label: 'offerIds' },
      { body: { skus: skus.slice(0, 200) },           label: 'skus-legacy' },
    ]
    let lastErr: unknown = null
    for (const { body, label } of attempts) {
      try {
        return await request<YandexStocksResponse>(url, token, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      } catch (e) {
        lastErr = e
        if (!(e instanceof YandexApiError && (e.status === 400 || e.status === 422))) throw e
        // Log the response body so if Yandex changes their schema again
        // we see WHY, not just "400" — the seller's Yandex API log only
        // shows status codes.
        console.warn(`[yandex stocks] ${label} shape rejected: ${(e as YandexApiError).body?.slice(0, 300)}`)
      }
    }
    throw lastErr
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
    // Yandex caps this endpoint at 200 items per page; higher values return
    // 400 "Parameter limit must be less than or equal to 200".
    const params = new URLSearchParams({ limit: '200' })
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

// ── Offer cards (POST is the read verb) ──────────────────────────────────────
// offer-cards is the only Partner-API payload that carries the seller-set
// characteristic values (parameterValues), including «Цвет». offer-mappings
// (used for the main product sync) does NOT return them. We read it purely to
// recover a variant colour when the offer / market-SKU NAME has no colour word
// (e.g. the J16 earphones, whose name is just "Беспроводные наушники J16 …").
// Read-only: allowlisted in APPROVED_POST_ENDPOINTS; no write capability here.
interface YandexOfferCardParam { parameterId?: number; valueId?: number; value?: string; unitId?: number }
interface YandexOfferCard { offerId?: string; parameterValues?: YandexOfferCardParam[] }
interface YandexOfferCardsResponse {
  result?: { offerCards?: YandexOfferCard[]; paging?: { nextPageToken?: string } }
}

// Returns offerId → resolved ColorKey for offers whose parameterValues contain a
// recognisable colour word. Best-effort: the caller uses it only as a fallback
// and swallows failures (accounts without card access answer 403/404). We scan
// every parameter value through resolveColor rather than hard-coding a colour
// parameterId — those ids are category-specific and the payload carries no
// parameter names, and only genuine colour words resolve, so the first hit wins.
export async function fetchAllYandexOfferCards(
  token: string,
  businessId: number,
): Promise<Map<string, string>> {
  const colorByOffer = new Map<string, string>()
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({ limit: '200' })
    if (pageToken) params.set('page_token', pageToken)
    const res = await withRetry(() => request<YandexOfferCardsResponse>(
      `/v2/businesses/${businessId}/offer-cards?${params}`,
      token,
      { method: 'POST', body: '{}' },
    ))
    for (const card of res.result?.offerCards ?? []) {
      if (!card.offerId || colorByOffer.has(card.offerId)) continue
      for (const p of card.parameterValues ?? []) {
        const key = resolveColor(p.value)?.key
        if (key) { colorByOffer.set(card.offerId, key); break }
      }
    }
    pageToken = res.result?.paging?.nextPageToken
  } while (pageToken)
  return colorByOffer
}

// Fetch stocks for all SKUs in batches of 500. Also returns the last HTTP
// error status if one occurred, so the sync can distinguish "endpoint said
// 0 items" from "endpoint returned 403/500".
export async function fetchAllYandexStocks(
  token: string,
  campaignId: string,
  skus: string[],
): Promise<{ stockMap: Map<string, number>; lastError: string | null; complete: boolean }> {
  const stockMap = new Map<string, number>()
  let lastError: string | null = null
  // Paging is sequential — each page's token comes from the one before — so a
  // failure part-way cannot be retried past, and the batch simply stops early
  // with a partly-filled map. Callers previously could not tell that apart from
  // a complete read, and absence in this map means "no data" downstream, which
  // preserves whatever a row already held. A truncated read therefore looked
  // exactly like "nothing changed". This flag is the difference.
  let complete = true
  for (let i = 0; i < skus.length; i += 200) {
    const batch = skus.slice(i, i + 200)
    try {
      let pageToken: string | undefined
      do {
        const res = await fetchYandexStocks(token, campaignId, batch, pageToken)
        // NB: do NOT early-exit on qty === 0. An explicit zero from YM
        // ("FIT bucket exists, count is 0") is real information — it means
        // "sold out". Skipping it left stockMap without the key, which the
        // downstream nullish-coalesce chain in sync.ts treated as "no data"
        // and preserved the previous DB value forever, so a product that
        // sold out on YM kept showing its last-known non-zero stock in
        // daromadchi. Always set the key; conflating "unknown" with "zero"
        // was the bug.
        const inc = (key: string, qty: number) => {
          if (!key || !Number.isFinite(qty)) return
          stockMap.set(key, (stockMap.get(key) ?? 0) + qty)
        }
        // Only trust FIT — this is what YM's own catalog UI shows as
        // "in stock". AVAILABLE / list[0] can reflect reserved, frozen, or
        // campaign-flag units that YM does NOT treat as sellable inventory,
        // so falling through to them causes daromadchi to show phantom
        // stock when YM says "Нет на складе".
        const countStocks = yandexSellableStock
        // Older response shape: result.skus[]
        for (const item of res.result.skus ?? []) {
          const key = item.sku ?? item.offerId ?? ''
          const stockList = item.warehouseStocks ?? item.stocks
          inc(key, countStocks(stockList))
        }
        // Newer response shape: result.warehouses[].offers[] — SUM ACROSS
        // warehouses only (multiple warehouses = separate physical stock),
        // but never across types within one warehouse.
        for (const w of res.result.warehouses ?? []) {
          for (const off of w.offers ?? []) {
            const key = off.offerId ?? ''
            inc(key, countStocks(off.stocks))
          }
        }
        pageToken = res.result.nextPageToken ?? res.result.paging?.nextPageToken
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
      complete = false
    }
  }
  return { stockMap, lastError, complete }
}

// ─── FBS warehouses (GET /v2/campaigns/{id}/warehouses) — READ ────────────────
// The warehouseId(s) a stock-update PUT targets. Most FBS sellers have exactly
// one. Used by the identifier backfill so a live write never guesses.
export interface YandexWarehouse {
  id: number
  name?: string
}

export async function fetchYandexWarehouses(token: string, campaignId: string): Promise<YandexWarehouse[]> {
  return withRetry(async () => {
    try {
      const data = await request<{ result?: { warehouses?: YandexWarehouse[] }; warehouses?: YandexWarehouse[] }>(
        `/v2/campaigns/${campaignId}/warehouses`,
        token,
      )
      return data.result?.warehouses ?? data.warehouses ?? []
    } catch (e) {
      if (e instanceof YandexApiError && (e.status === 404 || e.status === 403)) return []
      throw e
    }
  })
}

// Per-offer stock location (offerId → { warehouseId, count }) from the same
// offers/stocks READ used for stock numbers, but keeping the warehouseId this
// time. Prefers the per-warehouse response shape; falls back to the campaign's
// single warehouse when the endpoint only returns the flat skus[] shape.
export async function fetchYandexStockLocations(
  token: string,
  campaignId: string,
): Promise<Map<string, { warehouseId: number; count: number }>> {
  const out = new Map<string, { warehouseId: number; count: number }>()
  let fallbackWarehouse: number | null = null
  try {
    const whs = await fetchYandexWarehouses(token, campaignId)
    if (whs.length > 0) fallbackWarehouse = whs[0].id
  } catch { /* best-effort */ }

  const countFit = yandexSellableStock

  try {
    let pageToken: string | undefined
    do {
      const res = await fetchYandexStocks(token, campaignId, [], pageToken)
      // Newer shape: result.warehouses[].offers[] — warehouseId is authoritative.
      for (const w of res.result.warehouses ?? []) {
        const whId = w.warehouseId ?? fallbackWarehouse
        for (const off of w.offers ?? []) {
          if (!off.offerId || whId == null) continue
          out.set(off.offerId, { warehouseId: whId, count: countFit(off.stocks) })
        }
      }
      // Older shape: result.skus[] — no per-row warehouseId, use the fallback.
      for (const item of res.result.skus ?? []) {
        const key = item.sku ?? item.offerId
        if (!key || fallbackWarehouse == null) continue
        if (!out.has(key)) out.set(key, { warehouseId: fallbackWarehouse, count: countFit(item.warehouseStocks ?? item.stocks) })
      }
      pageToken = res.result.nextPageToken ?? res.result.paging?.nextPageToken
    } while (pageToken)
  } catch { /* best-effort — caller surfaces missing identifiers as a skip */ }

  return out
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
