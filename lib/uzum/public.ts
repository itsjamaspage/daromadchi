// Uzum public shopping API — no authentication required
// Used for market research: categories, top products, search
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

export const UZUM_PUBLIC_BASE = 'https://api.uzum.uz'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UzumPublicCategory {
  id: number
  title: string
  productAmount?: number
  icon?: string
  children?: UzumPublicCategory[]
}

export interface UzumPublicProduct {
  id: number
  title: string
  minFullPrice: number  // original price in so'm
  maxFullPrice: number
  minSellPrice: number  // discounted price in so'm
  maxSellPrice: number
  ordersAmount: number
  reviewsAmount: number
  rating: number
  category?: { id: number; title: string }
  photos?: { photoKey: string }[]
  shopTitle?: string
}

export interface MarketProductsResult {
  products: UzumPublicProduct[]
  total: number
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'uz-UZ,uz;q=0.9,ru;q=0.8,en;q=0.7',
} as const

const GRAPHQL_HEADERS = {
  'Content-Type': 'application/json',
  ...BROWSER_HEADERS,
  'Origin': 'https://uzum.uz',
  'Referer': 'https://uzum.uz/',
  'apollographql-client-name': 'web',
  'apollographql-client-version': '1.26.0',
} as const

async function pub<T>(path: string, init?: RequestInit, revalidate = 300): Promise<T> {
  const res = await marketplaceFetch(`${UZUM_PUBLIC_BASE}${path}`, {
    ...init,
    headers: {
      ...BROWSER_HEADERS,
      'Origin': 'https://uzum.uz',
      'Referer': 'https://uzum.uz/',
      ...init?.headers,
    },
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`Uzum public API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

function photoArrayToUrl(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null
  const p = photos[0] as Record<string, unknown>

  const link = p.link as Record<string, string> | undefined
  if (link?.high) return link.high
  if (link?.low) return link.low

  const photo = p.photo as Record<string, string> | undefined
  if (photo?.high) return photo.high
  if (photo?.low) return photo.low

  const key = (p.photoKey ?? p.key ?? p.photo_key) as string | undefined
  if (key) return `https://images.uzum.uz/${key}/t_product_540_high.jpg`

  if (typeof p.url === 'string') return p.url
  if (typeof p.src === 'string') return p.src

  return null
}

function walkForPhotos(obj: unknown, depth: number): string | null {
  if (depth > 4 || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/^photos?$|^images?$|^gallery$|^pictures?$/i.test(k)) {
      const url = photoArrayToUrl(v)
      if (url) return url
    }
    if (typeof v === 'object' && v !== null) {
      const url = walkForPhotos(v, depth + 1)
      if (url) return url
    }
  }
  return null
}

function extractPhotoUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>

  // payload.data.photos (documented REST structure)
  const payload = obj.payload as Record<string, unknown> | undefined
  const payloadData = payload?.data as Record<string, unknown> | undefined
  const url1 = photoArrayToUrl(payloadData?.photos)
  if (url1) return url1

  // data.photos
  const url2 = photoArrayToUrl((obj.data as Record<string, unknown> | undefined)?.photos)
  if (url2) return url2

  // payload.photos
  const url3 = photoArrayToUrl(payload?.photos)
  if (url3) return url3

  // top-level photos
  const url4 = photoArrayToUrl(obj.photos)
  if (url4) return url4

  return walkForPhotos(data, 0)
}

async function fetchProductPhotoGraphQL(productId: number): Promise<string | null> {
  const gql = `query ProductPage($id:Int!){makeProductPage(id:$id){photos{key link{high low}}}}`
  const res = await marketplaceFetch('https://graphql.uzum.uz', {
    method: 'POST',
    headers: GRAPHQL_HEADERS,
    body: JSON.stringify({
      operationName: 'ProductPage',
      query: gql,
      variables: { id: productId },
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GraphQL ${res.status}`)
  const data = await res.json() as {
    data?: { makeProductPage?: { photos?: Array<{ key?: string; link?: { high?: string; low?: string } }> } }
  }
  const photos = data?.data?.makeProductPage?.photos
  return photoArrayToUrl(photos)
}

// Fetch the first photo URL for a product by its public productId.
// The seller API does not return photos; this fills the gap.
export async function fetchProductPhoto(productId: number): Promise<string | null> {
  // Try REST API (no caching — failures must not be cached)
  try {
    const data = await pub<Record<string, unknown>>(`/api/v2/product/${productId}`, undefined, 0)
    const url = extractPhotoUrl(data)
    if (url) return url
    console.warn(`[fetchProductPhoto] REST ok but no photos for product ${productId}`)
  } catch (e) {
    console.warn(`[fetchProductPhoto] REST failed for product ${productId}:`, String(e).slice(0, 200))
  }

  // Fall back to GraphQL (proven to work via searchMarketProducts)
  try {
    const url = await fetchProductPhotoGraphQL(productId)
    if (url) return url
    console.warn(`[fetchProductPhoto] GraphQL returned no photos for product ${productId}`)
  } catch (e) {
    console.warn(`[fetchProductPhoto] GraphQL failed for product ${productId}:`, String(e).slice(0, 200))
  }

  return null
}

// Fetch per-SKU photo URLs for a product (keyed by SKU id string).
// The seller API gives only card-level photos shared across all SKUs.
// The public API exposes per-SKU photos when variants exist.
export async function fetchProductVariantPhotos(
  productId: number,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // REST: /api/v2/product/{id}
  try {
    const data = await pub<Record<string, unknown>>(
      `/api/v2/product/${productId}`,
      undefined,
      0,
    )
    const payload = data?.payload as Record<string, unknown> | undefined
    const inner = (payload?.data ?? data?.data ?? data) as
      | Record<string, unknown>
      | undefined
    if (inner) extractSkuPhotos(inner, result)
    if (result.size > 0) return result
  } catch {
    /* fall through to GraphQL */
  }

  // GraphQL: makeProductPage with skuList
  try {
    const gql = `query ProductPage($id:Int!){makeProductPage(id:$id){skuList{id photos{key link{high low}}}}}`
    const res = await marketplaceFetch('https://graphql.uzum.uz', {
      method: 'POST',
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({
        operationName: 'ProductPage',
        query: gql,
        variables: { id: productId },
      }),
      cache: 'no-store',
    })
    if (res.ok) {
      const json = (await res.json()) as {
        errors?: unknown
        data?: {
          makeProductPage?: {
            skuList?: Array<{
              id?: number
              photos?: Array<{
                key?: string
                link?: { high?: string; low?: string }
              }>
            }>
          }
        }
      }
      if (!json?.errors) {
        const skuList = json?.data?.makeProductPage?.skuList
        if (skuList) {
          for (const sku of skuList) {
            const id = sku.id
            if (id == null) continue
            const url = photoArrayToUrl(sku.photos as unknown)
            if (url) result.set(String(id), url)
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  return result
}

function extractSkuPhotos(
  obj: Record<string, unknown>,
  result: Map<string, string>,
) {
  const list = (obj.skuList ?? obj.variants ?? obj.skus) as
    | Array<Record<string, unknown>>
    | undefined
  if (!Array.isArray(list)) return
  for (const sku of list) {
    if (!sku || typeof sku !== 'object') continue
    const id = sku.id ?? sku.skuId
    if (id == null) continue
    const url =
      photoArrayToUrl(sku.photos as unknown) ??
      photoArrayToUrl(sku.gallery as unknown) ??
      (typeof sku.photo === 'string' ? sku.photo : null) ??
      (typeof sku.image === 'string' ? sku.image : null) ??
      (typeof sku.previewImage === 'string' ? sku.previewImage : null)
    if (url) result.set(String(id), url)
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getRootCategories(): Promise<UzumPublicCategory[]> {
  try {
    const data = await pub<UzumPublicCategory[] | { payload?: { categories?: UzumPublicCategory[] } }>(
      '/api/main/root-categories'
    )
    if (Array.isArray(data)) return data
    const nested = (data as { payload?: { categories?: UzumPublicCategory[] } }).payload?.categories
    return nested ?? []
  } catch {
    return []
  }
}

export async function getCategoryProducts(
  categoryId: number,
  page = 0,
  size = 40,
  sort: 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC' = 'ORDER_COUNT_DESC'
): Promise<MarketProductsResult> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
      sort,
      showAdultContent: 'true',
    })
    type Inner = { products?: UzumPublicProduct[]; total?: number; totalElements?: number }
    type CatRes = { payload?: Inner } & Inner
    const data = await pub<CatRes>(`/api/category/${categoryId}/products?${params}`)
    const payload: Inner = data.payload ?? data
    return {
      products: payload.products ?? [],
      total: payload.total ?? payload.totalElements ?? 0,
    }
  } catch {
    return { products: [], total: 0 }
  }
}

export async function searchMarketProducts(
  query: string,
  size = 40,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sort: 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC' = 'ORDER_COUNT_DESC'
): Promise<MarketProductsResult> {
  try {
    const gql = `query MakeSearch($text:String!,$limit:Int!){makeSearch(query:{text:$text,pagination:{offset:0,limit:$limit},showAdultContent:NONE}){total items{catalogCard{id title minSellPrice minFullPrice feedbackQuantity rating photos{key link{high low}}}}}}`
    const res = await marketplaceFetch('https://graphql.uzum.uz', {
      method: 'POST',
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({ operationName: 'MakeSearch', query: gql, variables: { text: query, limit: size } }),
      next: { revalidate: 60 },
    })
    if (!res.ok) {
      console.error('[searchMarketProducts] GraphQL HTTP error:', res.status, await res.text().catch(() => ''))
      throw new Error(`Uzum GraphQL ${res.status}`)
    }
    const rawText = await res.text()
    console.log('[searchMarketProducts] raw response (first 500):', rawText.slice(0, 500))
    const data = JSON.parse(rawText) as { data?: { makeSearch?: { total?: number; items?: Array<{ catalogCard: Record<string, unknown> }> } }; errors?: unknown }
    if (data.errors) console.error('[searchMarketProducts] GraphQL errors:', JSON.stringify(data.errors))
    console.log('[searchMarketProducts] total:', data?.data?.makeSearch?.total, 'items:', data?.data?.makeSearch?.items?.length)
    const items = data?.data?.makeSearch?.items ?? []
    const products: UzumPublicProduct[] = items.map(item => {
      const c = item.catalogCard
      return {
        id:            c.id as number,
        title:         c.title as string,
        minSellPrice:  c.minSellPrice as number,
        minFullPrice:  c.minFullPrice as number,
        maxSellPrice:  c.minSellPrice as number,
        maxFullPrice:  c.minFullPrice as number,
        ordersAmount:  Math.round((c.feedbackQuantity as number) * 15),
        reviewsAmount: c.feedbackQuantity as number,
        rating:        c.rating as number,
        photos:        (c.photos as Array<{ key: string }>)?.map(p => ({ photoKey: p.key })),
      }
    })
    return { products, total: data?.data?.makeSearch?.total ?? products.length }
  } catch (err) {
    console.error('[searchMarketProducts] caught error:', err)
    return { products: [], total: 0 }
  }
}
