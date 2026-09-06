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

  const res = await marketplaceFetch(
    `${UZUM_API_BASE}/v1/product/shop/${sellerShopId}?page=0&size=20&filter=ALL&sortBy=DEFAULT&order=ASC`,
    { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
  )
  const text = await res.text()
  const data = JSON.parse(text)
  const cards = (data?.productList ?? []) as Record<string, unknown>[]

  const multiSkuCards = cards.filter(c => Array.isArray(c.skuList) && (c.skuList as unknown[]).length > 1)

  const cardSummaries = multiSkuCards.slice(0, 5).map(card => {
    const skuList = card.skuList as Record<string, unknown>[]

    const cardImageUrl = (card.image ?? card.previewImg
      ?? (card.photos as Array<Record<string, unknown>> | undefined)?.[0]) as string | null

    return {
      productId: card.productId,
      title: card.title,
      cardLevelImage: cardImageUrl,
      cardPhotoFields: Object.fromEntries(
        Object.entries(card).filter(([k]) =>
          /photo|image|picture|gallery|media|preview|thumb|icon|avatar|cover/i.test(k)
        ).map(([k, v]) => [k, Array.isArray(v) ? { array: true, length: v.length, first: v[0] } : v])
      ),
      skus: skuList.map(sku => {
        const photoFields = Object.fromEntries(
          Object.entries(sku).filter(([k]) =>
            /photo|image|picture|gallery|media|preview|thumb|icon|avatar|cover/i.test(k)
          )
        )
        const previewImage = sku.previewImage as string | undefined
        const previewImg = sku.previewImg as string | undefined
        const syncWouldUse = previewImage
          ? `${previewImage}/t_product_540_high.jpg`
          : previewImg
            ? `${previewImg}/t_product_540_high.jpg`
            : cardImageUrl

        return {
          skuId: sku.skuId,
          skuTitle: sku.skuTitle,
          allKeys: Object.keys(sku),
          photoFields: Object.keys(photoFields).length > 0 ? photoFields : 'NONE',
          syncWouldUse,
        }
      }),
    }
  })

  return NextResponse.json({
    ok: true,
    sellerShopId,
    totalCards: cards.length,
    multiSkuCardCount: multiSkuCards.length,
    cards: cardSummaries,
  })
})
