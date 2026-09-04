import { NextResponse } from 'next/server'
import { eq, and, isNotNull, count } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { UZUM_PUBLIC_BASE, fetchProductPhoto } from '@/lib/uzum/public'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Uzum shop/token topilmadi' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  // 1. Fetch raw product cards from the seller API and dump the photos field
  let sellerPhotos: unknown = null
  let sellerShopId: number | null = null
  try {
    const shopsRes = await marketplaceFetch(`${UZUM_API_BASE}/v1/shops`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const shopsData = await shopsRes.json().catch(() => null)
    const arr = Array.isArray(shopsData) ? shopsData : (shopsData?.shops ?? shopsData?.data ?? [])
    sellerShopId = (arr as { id: number }[])[0]?.id ?? null
  } catch (e) {
    sellerPhotos = { error: `shops: ${String(e).slice(0, 200)}` }
  }

  if (sellerShopId && !sellerPhotos) {
    try {
      const res = await marketplaceFetch(
        `${UZUM_API_BASE}/v1/product/shop/${sellerShopId}?page=0&size=5&filter=ALL&sortBy=DEFAULT&order=ASC`,
        { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
      )
      const text = await res.text()
      const data = JSON.parse(text)
      const cards = data?.productList ?? []
      sellerPhotos = {
        httpStatus: res.status,
        cardCount: cards.length,
        cards: (cards as Record<string, unknown>[]).slice(0, 3).map((card) => ({
          productId: card.productId,
          title: card.title,
          hasPhotosField: 'photos' in card,
          photosType: card.photos === undefined ? 'undefined'
            : card.photos === null ? 'null'
            : Array.isArray(card.photos) ? `array[${(card.photos as unknown[]).length}]`
            : typeof card.photos,
          photosRaw: card.photos,
          allTopLevelKeys: Object.keys(card),
        })),
      }
    } catch (e) {
      sellerPhotos = { error: `products: ${String(e).slice(0, 300)}` }
    }
  }

  // 2. Pick a product ID from DB and test the public API photo fetch
  const [dbProduct] = await db.select({
    marketplace_product_id: products.marketplace_product_id,
    title: products.title,
    image_url: products.image_url,
  }).from(products)
    .where(and(eq(products.shop_id, shop.id), eq(products.is_archived, false)))
    .limit(1)

  // Find the uzum productId (card-level) from variant_group_key
  const [dbProductWithGroup] = await db.select({
    variant_group_key: products.variant_group_key,
    title: products.title,
    image_url: products.image_url,
  }).from(products)
    .where(and(
      eq(products.shop_id, shop.id),
      eq(products.is_archived, false),
      isNotNull(products.variant_group_key),
    ))
    .limit(1)

  let publicApiProbe: unknown = null
  const groupKey = dbProductWithGroup?.variant_group_key
  const match = groupKey?.match(/^uzum:(\d+)$/)
  const testProductId = match ? Number(match[1]) : null

  if (testProductId) {
    // Raw public API call — dump full response structure
    try {
      const rawRes = await marketplaceFetch(`${UZUM_PUBLIC_BASE}/api/v2/product/${testProductId}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'uz-UZ,uz;q=0.9,ru;q=0.8,en;q=0.7',
        },
        next: { revalidate: 0 },
      })
      const rawText = await rawRes.text()
      let rawJson: unknown = null
      try { rawJson = JSON.parse(rawText) } catch { /* not JSON */ }

      // Walk the response to find any photos/images arrays
      const photoFields: Record<string, unknown> = {}
      const walk = (obj: unknown, path: string, depth: number) => {
        if (depth > 5 || !obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) return
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const p = path ? `${path}.${k}` : k
          if (/photo|image|picture|gallery|media/i.test(k)) {
            photoFields[p] = v
          }
          if (typeof v === 'object' && v !== null && depth < 5) {
            walk(v, p, depth + 1)
          }
        }
      }
      walk(rawJson, '', 0)

      // Also try the exact extraction path the code uses
      const payload = (rawJson as Record<string, unknown>)?.payload as Record<string, unknown> | undefined
      const dataObj = payload?.data as Record<string, unknown> | undefined
      const photosAtExpectedPath = dataObj?.photos

      publicApiProbe = {
        httpStatus: rawRes.status,
        testProductId,
        bodyLength: rawText.length,
        bodySnippet: rawText.slice(0, 500),
        topLevelKeys: rawJson && typeof rawJson === 'object' ? Object.keys(rawJson) : null,
        payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
        dataKeys: dataObj && typeof dataObj === 'object' ? Object.keys(dataObj) : null,
        photosAtExpectedPath: photosAtExpectedPath === undefined ? 'MISSING'
          : photosAtExpectedPath === null ? 'null'
          : Array.isArray(photosAtExpectedPath) ? { count: photosAtExpectedPath.length, first: photosAtExpectedPath[0] }
          : typeof photosAtExpectedPath,
        allPhotoFields: Object.keys(photoFields).length > 0 ? photoFields : 'NONE FOUND',
      }
    } catch (e) {
      publicApiProbe = { error: String(e).slice(0, 300), testProductId }
    }

    // 3. Also test the existing fetchProductPhoto function
    let fetchResult: unknown = null
    try {
      const url = await fetchProductPhoto(testProductId)
      fetchResult = { returned: url }
    } catch (e) {
      fetchResult = { error: String(e).slice(0, 200) }
    }
    publicApiProbe = { ...publicApiProbe as Record<string, unknown>, fetchProductPhotoResult: fetchResult }
  }

  // 4. Count how many products have/lack image_url
  const [{ total }] = await db.select({ total: count() }).from(products)
    .where(and(eq(products.shop_id, shop.id), eq(products.is_archived, false)))
  const [{ withImage }] = await db.select({ withImage: count() }).from(products)
    .where(and(eq(products.shop_id, shop.id), eq(products.is_archived, false), isNotNull(products.image_url)))

  return NextResponse.json({
    ok: true,
    dbStats: {
      totalProducts: total,
      withImageUrl: withImage,
      withoutImageUrl: total - withImage,
      sampleProduct: dbProduct ? {
        title: dbProduct.title,
        image_url: dbProduct.image_url,
        marketplace_product_id: dbProduct.marketplace_product_id,
      } : null,
    },
    sellerApiPhotos: sellerPhotos,
    publicApiPhotos: publicApiProbe,
    hint: 'sellerApiPhotos shows what the seller API returns in card.photos. publicApiPhotos shows what api.uzum.uz/api/v2/product/{id} returns. fetchProductPhotoResult shows what the existing extraction function returns. Compare to find the mismatch.',
  })
})
