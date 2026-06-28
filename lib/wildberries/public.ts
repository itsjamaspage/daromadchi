// Wildberries public catalogue API — no authentication required.
// Used for market research: search top products by name.
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

export interface WbPublicProduct {
  id: number
  name: string
  brand: string
  sellPrice: number   // discounted price, in rubles
  fullPrice: number   // original price, in rubles
  rating: number
  feedbacks: number    // number of reviews
  supplierId?: number
}

export interface WbProductsResult {
  products: WbPublicProduct[]
  total: number
}

type WbSort = 'popular' | 'priceup' | 'pricedown' | 'rate'

interface WbRawProduct {
  id: number
  name: string
  brand?: string
  salePriceU?: number
  priceU?: number
  rating?: number
  reviewRating?: number
  feedbacks?: number
  supplierId?: number
  sizes?: { price?: { product?: number; basic?: number } }[]
}

interface WbSearchResponse {
  data?: { products?: WbRawProduct[] }
  products?: WbRawProduct[]
}

// Resolve a price from the several shapes WB has used over time (kopecks → rubles)
function resolvePrice(p: WbRawProduct, kind: 'sell' | 'full'): number {
  const sizePrice = p.sizes?.[0]?.price
  if (sizePrice) {
    const raw = kind === 'sell' ? sizePrice.product : sizePrice.basic
    if (raw) return Math.round(raw / 100)
  }
  const raw = kind === 'sell' ? p.salePriceU : p.priceU
  return raw ? Math.round(raw / 100) : 0
}

export async function searchWbProducts(
  query: string,
  sort: WbSort = 'popular',
  limit = 40,
): Promise<WbProductsResult> {
  try {
    const params = new URLSearchParams({
      appType: '1',
      curr: 'rub',
      dest: '-1257786',
      query,
      resultset: 'catalog',
      sort,
      spp: '30',
    })
    const res = await marketplaceFetch(
      `https://search.wb.ru/exactmatch/ru/common/v5/search?${params}`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) throw new Error(`WB public API ${res.status}`)
    const data = (await res.json()) as WbSearchResponse
    const raw = data.data?.products ?? data.products ?? []
    const products: WbPublicProduct[] = raw.slice(0, limit).map(p => ({
      id:         p.id,
      name:       p.name ?? '',
      brand:      p.brand ?? '',
      sellPrice:  resolvePrice(p, 'sell'),
      fullPrice:  resolvePrice(p, 'full'),
      rating:     p.reviewRating ?? p.rating ?? 0,
      feedbacks:  p.feedbacks ?? 0,
      supplierId: p.supplierId,
    }))
    return { products, total: products.length }
  } catch {
    return { products: [], total: 0 }
  }
}
