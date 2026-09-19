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

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  function proxyImgbbUrl(url: string): string {
    if (!appBase) return url
    try {
      const parsed = new URL(url)
      if (parsed.hostname === 'i.ibb.co') {
        return `${appBase}/api/img${parsed.pathname}`
      }
    } catch { /* keep as-is */ }
    return url
  }

  // Build Russian-language offers (primary push)
  const offers: YandexOfferUpdate[] = body.offers.map(o => ({
    offerId: o.offerId,
    name: o.name,
    category: o.category,
    marketCategoryId: o.marketCategoryId,
    vendor: o.vendor,
    description: o.description,
    pictures: o.pictures?.map(proxyImgbbUrl),
    barcodes: o.barcodes,
    manufacturerCountries: o.manufacturerCountries,
    weightDimensions: o.weightDimensions,
    basicPrice: o.basicPrice,
    parameterValues: o.parameterValues,
    customsCommodityCodes: o.customsCommodityCodes,
    commodityCodes: o.commodityCodes,
  }))

  // Build Uzbek-language offers (only offerId + name + description needed)
  const uzOffers: YandexOfferUpdate[] = body.offers
    .filter(o => o.uz_name || o.uz_description)
    .map(o => ({
      offerId: o.offerId,
      name: o.uz_name || o.name,
      description: o.uz_description || o.description,
    }))

  logger.info('yandex_push_offers', {
    shopId: shop.id,
    offerCount: offers.length,
    uzOfferCount: uzOffers.length,
    offers: offers.map(o => ({
      offerId: o.offerId,
      name: o.name?.slice(0, 50),
      pictureCount: o.pictures?.length ?? 0,
      pictures: o.pictures?.slice(0, 3),
      hasCategoryId: !!o.marketCategoryId,
      hasVendor: !!o.vendor,
    })),
  })

  // 1. Push Russian content (primary)
  const result = await pushProducts({ shop: writeShop, userId: user.id, offers })

  if (result.status !== 'sent') {
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
  }

  if (result.responseBody) {
    logger.info('yandex_push_response', {
      shopId: shop.id,
      logId: result.logId,
      responseBody: result.responseBody.slice(0, 500),
    })
  }

  // 2. Push Uzbek content (supplementary — uses ?language=UZ query param)
  let uzLogId: string | undefined
  if (uzOffers.length > 0) {
    try {
      const uzResult = await pushProducts({
        shop: writeShop, userId: user.id, offers: uzOffers, language: 'UZ',
      })
      uzLogId = uzResult.logId
      if (uzResult.status !== 'sent') {
        logger.warn('yandex_push_uz_failed', {
          shopId: shop.id, status: uzResult.status, reason: uzResult.reason,
        })
      } else {
        logger.info('yandex_push_uz_sent', {
          shopId: shop.id, uzLogId, offerCount: uzOffers.length,
        })
      }
    } catch (err) {
      logger.error('yandex_push_uz_error', {
        shopId: shop.id, error: String(err).slice(0, 300),
      })
    }
  }

  let yandexResponse: unknown
  if (result.responseBody) {
    try { yandexResponse = JSON.parse(result.responseBody) } catch { /* not JSON */ }
  }

  return NextResponse.json({
    ok: true,
    logId: result.logId,
    uzLogId,
    offerCount: offers.length,
    totalPictures: offers.reduce((n, o) => n + (o.pictures?.length ?? 0), 0),
    offers: offers.map(o => ({
      offerId: o.offerId,
      pictures: o.pictures,
      hasVendor: !!o.vendor,
      hasDimensions: !!o.weightDimensions,
      hasBarcodes: !!o.barcodes?.length,
      hasCommodityCodes: !!o.commodityCodes?.length,
      hasParameterValues: !!o.parameterValues?.length,
    })),
    yandexResponse,
  })
})
