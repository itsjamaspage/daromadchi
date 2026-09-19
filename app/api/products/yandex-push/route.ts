import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { pushProducts, type ProductWriteShop } from '@/lib/marketplace/product-writer'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { YANDEX_API_BASE, type YandexOfferUpdate } from '@/lib/yandex/client'
import { logger } from '@/lib/logger'

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
  }))

  const result = await pushProducts({ shop: writeShop, userId: user.id, offers })

  if (result.status === 'sent') {
    // Verify offers actually landed — query offer-mappings after a brief delay
    let verification: { found: string[]; missing: string[] } | undefined
    try {
      await new Promise(r => setTimeout(r, 3000))
      const token = shop.api_key_encrypted ? decrypt(shop.api_key_encrypted) : ''
      const verifyUrl = `${YANDEX_API_BASE}/v2/businesses/${shop.business_id}/offer-mappings`
      const verifyRes = await marketplaceFetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Api-Key': token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ offerIds: offers.map(o => o.offerId) }),
        intent: 'read',
      })
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json() as {
          result?: { offerMappings?: { offer?: { offerId?: string } }[] }
        }
        const foundIds = new Set(
          (verifyData.result?.offerMappings ?? [])
            .map(m => m.offer?.offerId)
            .filter(Boolean),
        )
        const found = offers.filter(o => foundIds.has(o.offerId)).map(o => o.offerId)
        const missing = offers.filter(o => !foundIds.has(o.offerId)).map(o => o.offerId)
        verification = { found, missing }
      }
    } catch (err) {
      logger.warn('product_push_verify_failed', { error: String(err).slice(0, 200) })
    }

    return NextResponse.json({
      ok: true,
      logId: result.logId,
      yandexResponse: result.responseBody,
      verification,
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
