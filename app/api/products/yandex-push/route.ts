import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { pushProducts, type ProductWriteShop } from '@/lib/marketplace/product-writer'
import { logger } from '@/lib/logger'
import type { YandexOfferUpdate } from '@/lib/yandex/client'

export const runtime = 'nodejs'
export const maxDuration = 30

interface PushBody {
  offers: {
    offerId: string
    name: string
    category?: string
    marketCategoryId?: number
    vendor?: string
    description?: string
    pictures?: string[]
    barcodes?: string[]
    manufacturerCountries?: string[]
    weightDimensions?: {
      weight: number
      length: number
      width: number
      height: number
    }
    basicPrice?: { value: number; currencyId?: string; discountBase?: number }
    parameterValues?: { parameterId: number; valueId?: number; value?: string; unitId?: number }[]
    customsCommodityCodes?: { code: string; type?: string }[]
    commodityCodes?: { code: string; type: 'CUSTOMS_COMMODITY_CODE' | 'IKPU_CODE' | 'OKPD2_CODE' }[]
    uz_name?: string
    uz_description?: string
  }[]
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as PushBody
  if (!body.offers?.length) {
    return NextResponse.json({ error: 'No offers provided' }, { status: 400 })
  }

  const [shop] = await db
    .select({
      id: shops.id,
      marketplace: shops.marketplace,
      api_key_encrypted: shops.api_key_encrypted,
      business_id: shops.business_id,
    })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))
    .limit(1)

  if (!shop) {
    return NextResponse.json({ error: 'No active Yandex Market shop found' }, { status: 404 })
  }
  if (!shop.business_id) {
    return NextResponse.json({ error: 'Shop missing business_id — run sync first' }, { status: 400 })
  }

  const writeShop: ProductWriteShop = {
    id: shop.id,
    marketplace: 'yandex_market',
    api_key_encrypted: shop.api_key_encrypted,
    business_id: shop.business_id,
  }

  const offers: YandexOfferUpdate[] = body.offers.map(o => ({
    offerId: o.offerId,
    name: o.name,
    category: o.category,
    marketCategoryId: o.marketCategoryId,
    vendor: o.vendor,
    description: o.description,
    pictures: o.pictures,
    barcodes: o.barcodes,
    manufacturerCountries: o.manufacturerCountries,
    weightDimensions: o.weightDimensions,
    basicPrice: o.basicPrice,
    parameterValues: o.parameterValues,
    customsCommodityCodes: o.customsCommodityCodes,
    commodityCodes: o.commodityCodes,
    uz_name: o.uz_name,
    uz_description: o.uz_description,
  }))

  logger.info('yandex_push_offers', {
    shopId: shop.id,
    offerCount: offers.length,
    offers: offers.map(o => ({
      offerId: o.offerId,
      name: o.name?.slice(0, 50),
      pictureCount: o.pictures?.length ?? 0,
      pictures: o.pictures?.slice(0, 3),
      hasCategoryId: !!o.marketCategoryId,
      hasVendor: !!o.vendor,
    })),
  })

  const result = await pushProducts({ shop: writeShop, userId: user.id, offers })

  if (result.status === 'sent') {
    if (result.responseBody) {
      logger.info('yandex_push_response', {
        shopId: shop.id,
        logId: result.logId,
        responseBody: result.responseBody.slice(0, 500),
      })
    }
    return NextResponse.json({
      ok: true,
      logId: result.logId,
      offerCount: offers.length,
      totalPictures: offers.reduce((n, o) => n + (o.pictures?.length ?? 0), 0),
    })
  }

  let detail: string | undefined
  if (result.responseBody) {
    try {
      const parsed = JSON.parse(result.responseBody)
      detail = parsed.errors?.map((e: { message?: string }) => e.message).join('; ')
        || parsed.error?.message
        || parsed.message
    } catch { /* not JSON */ }
  }

  return NextResponse.json(
    { error: detail || result.reason || 'Product push failed', status: result.status, logId: result.logId },
    { status: result.httpStatus ?? 500 },
  )
})
