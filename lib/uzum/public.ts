// Uzum public shopping API — no authentication required
// Used for market research: categories, top products, search
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

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function pub<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${UZUM_PUBLIC_BASE}${path}`, {
    ...init,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      ...init?.headers,
    },
    next: { revalidate: 300 }, // cache 5 minutes
  })
  if (!res.ok) throw new Error(`Uzum public API ${res.status}: ${path}`)
  return res.json() as Promise<T>
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
  sort: 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC' = 'ORDER_COUNT_DESC'
): Promise<MarketProductsResult> {
  try {
    const params = new URLSearchParams({
      text: query,
      size: String(size),
      sort,
      showAdultContent: 'true',
    })
    type SInner = { products?: UzumPublicProduct[]; total?: number; totalElements?: number }
    type SearchRes = { payload?: SInner } & SInner
    const data = await pub<SearchRes>(`/api/v2/search/products?${params}`)
    const payload: SInner = data.payload ?? data
    return {
      products: payload.products ?? [],
      total: payload.total ?? payload.totalElements ?? 0,
    }
  } catch {
    return { products: [], total: 0 }
  }
}
