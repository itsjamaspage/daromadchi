import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  // Discover seller shopId
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
    return NextResponse.json({ ok: false, error: `shops: ${String(e).slice(0, 200)}` })
  }

  if (!sellerShopId) {
    return NextResponse.json({ ok: false, error: 'No seller shopId found' })
  }

  // Fetch first page of seller products — raw data
  const res = await marketplaceFetch(
    `${UZUM_API_BASE}/v1/product/shop/${sellerShopId}?page=0&size=20&filter=ALL&sortBy=DEFAULT&order=ASC`,
    { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
  )
  const text = await res.text()
  const data = JSON.parse(text)
  const cards = (data?.productList ?? []) as Record<string, unknown>[]

  // Find a card with multiple SKUs (colour variants)
  const multiSkuCards = cards.filter(c => Array.isArray(c.skuList) && (c.skuList as unknown[]).length > 1)
  const targetCard = multiSkuCards[0] ?? cards[0]

  if (!targetCard) {
    return NextResponse.json({ ok: true, message: 'No product cards found', sellerShopId })
  }

  const cardKeys = Object.keys(targetCard)
  const skuList = targetCard.skuList as Record<string, unknown>[] | undefined

  // For each SKU, dump ALL keys and any photo/image related values
  const skuDump = (skuList ?? []).map(sku => {
    const allKeys = Object.keys(sku)
    const photoRelated: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sku)) {
      if (/photo|image|picture|gallery|media|preview|thumb|icon|avatar|cover/i.test(k)) {
        photoRelated[k] = v
      }
    }
    return {
      skuId: sku.skuId,
      skuTitle: sku.skuTitle,
      allKeys,
      photoRelatedFields: Object.keys(photoRelated).length > 0 ? photoRelated : 'NONE',
      characteristics: sku.characteristics,
    }
  })

  // Also dump card-level photo fields
  const cardPhotoFields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(targetCard)) {
    if (/photo|image|picture|gallery|media|preview|thumb|icon|avatar|cover/i.test(k)) {
      if (Array.isArray(v)) {
        cardPhotoFields[k] = { type: 'array', length: v.length, first: v[0] }
      } else {
        cardPhotoFields[k] = v
      }
    }
  }

  // Check if there's a per-product detail endpoint
  const productId = targetCard.productId as number
  let productDetailProbe: unknown = null
  try {
    const detailRes = await marketplaceFetch(
      `${UZUM_API_BASE}/v1/product/${productId}`,
      { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
    )
    const detailText = await detailRes.text()
    if (detailRes.ok) {
      const detail = JSON.parse(detailText)
      const detailKeys = detail && typeof detail === 'object' ? Object.keys(detail) : null
      const detailSkuList = (detail?.skuList ?? detail?.variants ?? detail?.skus) as Record<string, unknown>[] | undefined
      productDetailProbe = {
        status: detailRes.status,
        topKeys: detailKeys,
        hasSkuList: !!detailSkuList,
        skuCount: detailSkuList?.length,
        skuSample: detailSkuList?.slice(0, 2).map(s => ({
          keys: Object.keys(s),
          photoFields: Object.fromEntries(
            Object.entries(s).filter(([k]) => /photo|image|preview|thumb|gallery|media|cover/i.test(k))
          ),
        })),
      }
    } else {
      productDetailProbe = { status: detailRes.status, body: detailText.slice(0, 300) }
    }
  } catch (e) {
    productDetailProbe = { error: String(e).slice(0, 200) }
  }

  // Check swagger for any photo-related endpoints
  let swaggerPhotoEndpoints: unknown = null
  try {
    const specRes = await marketplaceFetch(`${UZUM_API_BASE}/swagger/api-docs`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (specRes.ok) {
      const spec = await specRes.json() as { paths?: Record<string, unknown> }
      const photoPaths = Object.keys(spec.paths ?? {}).filter(p =>
        /photo|image|media|gallery|picture/i.test(p)
      )
      const productPaths = Object.keys(spec.paths ?? {}).filter(p =>
        /product/i.test(p)
      )
      swaggerPhotoEndpoints = { photoPaths, productPaths }
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    ok: true,
    sellerShopId,
    cardCount: cards.length,
    multiSkuCardCount: multiSkuCards.length,
    targetCard: {
      productId: targetCard.productId,
      title: targetCard.title,
      allCardKeys: cardKeys,
      cardPhotoFields,
      skuCount: skuList?.length ?? 0,
      skus: skuDump,
    },
    productDetailEndpoint: productDetailProbe,
    swaggerEndpoints: swaggerPhotoEndpoints,
  })
})
