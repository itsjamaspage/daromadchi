import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { resolveColor } from '@/lib/products/resolveColor'
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

  let sellerShopId: number | null = null
  try {
    const shopsRes = await marketplaceFetch(`${UZUM_API_BASE}/v1/shops`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const shopsData = await shopsRes.json().catch(() => null)
    const arr = Array.isArray(shopsData) ? shopsData : (shopsData?.shops ?? shopsData?.data ?? [])
    sellerShopId = (arr as { id: number }[])[0]?.id ?? null
  } catch { /* ignore */ }

  if (!sellerShopId) {
    return NextResponse.json({ ok: false, error: 'Could not discover seller shopId' }, { status: 400 })
  }

  const res = await marketplaceFetch(
    `${UZUM_API_BASE}/v1/product/shop/${sellerShopId}?page=0&size=100&filter=ALL&sortBy=DEFAULT&order=ASC`,
    { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
  )
  const data = await res.json()
  const cards = data?.productList ?? []

  const dbProducts = await db.select({
    marketplace_product_id: products.marketplace_product_id,
    variant_color: products.variant_color,
    title: products.title,
  }).from(products)
    .where(and(
      eq(products.shop_id, shop.id),
      eq(products.is_archived, false),
    ))

  const dbColorMap = new Map(dbProducts.map(p => [p.marketplace_product_id, { color: p.variant_color, title: p.title }]))

  const skuDetails: Record<string, unknown>[] = []

  for (const card of cards as Record<string, unknown>[]) {
    const skuList = card.skuList as Record<string, unknown>[] | undefined
    for (const sku of skuList ?? []) {
      const skuId = String(sku.skuId)
      const dbInfo = dbColorMap.get(skuId)

      const characteristics = sku.characteristics as string | undefined
      const characteristicsList = sku.characteristicsList as Array<{
        characteristicTitle?: { uz?: string; ru?: string }
        characteristicValue?: { uz?: string; ru?: string }
      }> | undefined

      const colorCharacteristic = characteristicsList?.find(
        (x) => x.characteristicTitle?.ru === 'Цвет' || x.characteristicTitle?.uz === 'Rang',
      )

      const fromSkuTitle = resolveColor(sku.skuTitle as string)
      const fromCharRu = resolveColor(colorCharacteristic?.characteristicValue?.ru)
      const fromCharUz = resolveColor(colorCharacteristic?.characteristicValue?.uz)
      const fromCharFlat = resolveColor(characteristics)

      skuDetails.push({
        productId: card.productId,
        cardTitle: card.title,
        skuId: sku.skuId,
        skuTitle: sku.skuTitle,
        characteristics,
        characteristicsList,
        colorCharacteristic: colorCharacteristic ?? 'NOT FOUND',
        resolvedColor: {
          fromSkuTitle: fromSkuTitle?.key ?? null,
          fromCharRu: fromCharRu?.key ?? null,
          fromCharUz: fromCharUz?.key ?? null,
          fromCharFlat: fromCharFlat?.key ?? null,
          finalResult: fromSkuTitle?.key
            ?? fromCharRu?.key
            ?? fromCharUz?.key
            ?? fromCharFlat?.key
            ?? null,
        },
        dbStoredColor: dbInfo?.color ?? 'NOT IN DB',
        dbTitle: dbInfo?.title ?? 'NOT IN DB',
        mismatch: dbInfo?.color !== undefined && dbInfo.color !== (
          fromSkuTitle?.key ?? fromCharRu?.key ?? fromCharUz?.key ?? fromCharFlat?.key ?? null
        ),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    totalSkus: skuDetails.length,
    mismatches: skuDetails.filter(s => s.mismatch).length,
    skus: skuDetails,
  })
})
