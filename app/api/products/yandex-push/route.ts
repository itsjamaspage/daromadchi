import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { pushProducts, type ProductWriteShop } from '@/lib/marketplace/product-writer'
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
  }))

  const result = await pushProducts({ shop: writeShop, userId: user.id, offers })

  if (result.status === 'sent') {
    return NextResponse.json({ ok: true, logId: result.logId })
  }

  return NextResponse.json(
    { error: result.reason ?? 'Product push failed', status: result.status, logId: result.logId },
    { status: result.httpStatus ?? 500 },
  )
})
