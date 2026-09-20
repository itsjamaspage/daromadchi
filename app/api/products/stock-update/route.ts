import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { pushStock } from '@/lib/marketplace/stock-writer'
import type { MarketplaceType } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const quantity = typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? body.quantity : NaN

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
  if (Number.isNaN(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'quantity must be a non-negative number' }, { status: 400 })
  }

  const userShops = await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
    api_mode: shops.api_mode,
  }).from(shops).where(and(eq(shops.user_id, user.id), eq(shops.is_active, true)))

  const shopIds = userShops.map(s => s.id)
  if (shopIds.length === 0) return NextResponse.json({ error: 'No shops' }, { status: 400 })

  const [product] = await db.select({
    id: products.id,
    shop_id: products.shop_id,
    sku: products.sku,
    market_barcode: products.market_barcode,
    market_sku: products.market_sku,
    market_warehouse_id: products.market_warehouse_id,
  }).from(products).where(and(
    eq(products.id, productId),
    inArray(products.shop_id, shopIds),
  ))

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const shop = userShops.find(s => s.id === product.shop_id)
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  if (shop.api_mode === 'read_only') {
    return NextResponse.json({
      ok: false,
      status: 'blocked',
      reason: 'Магазин в режиме «только чтение». Включите режим записи остатков в настройках.',
    }, { status: 403 })
  }

  const marketplace = shop.marketplace as MarketplaceType
  const result = await pushStock({
    shop: {
      id: shop.id,
      marketplace,
      api_key_encrypted: shop.api_key_encrypted,
      shop_id_external: shop.shop_id_external,
    },
    sku: marketplace === 'yandex_market' ? product.market_sku : product.sku,
    barcode: product.market_barcode,
    uzumSkuId: marketplace === 'uzum' ? product.market_sku : null,
    quantity: Math.trunc(quantity),
    version: Date.now(),
    warehouseId: product.market_warehouse_id,
    productId: product.id,
  })

  if (result.status === 'sent') {
    await db.update(products)
      .set({ stock_quantity: result.quantity, stock_override: result.quantity })
      .where(eq(products.id, product.id))
    revalidateTag('product-data', { expire: 0 })
  }

  const REASON_LABELS: Record<string, string> = {
    missing_uzum_skuid: 'Товар не привязан к FBS (нет skuId). Запустите синхронизацию.',
    missing_barcode: 'Отсутствует штрихкод товара. Запустите синхронизацию.',
    missing_campaign: 'Магазин не настроен (нет campaignId).',
    missing_sku: 'Отсутствует артикул (shopSku). Запустите синхронизацию.',
    missing_warehouse: 'Склад не найден (warehouseId). Запустите синхронизацию.',
    no_token: 'API-ключ магазина недействителен.',
    kill_switch: 'Запись остатков временно отключена.',
    guard_blocked: 'Запись заблокирована (режим только чтение).',
    stale_version: 'Более новое обновление уже применено.',
    dry_run: 'Тестовый режим — запись не отправлена.',
  }

  let humanReason = result.reason ? (REASON_LABELS[result.reason] ?? result.reason) : undefined
  if (humanReason && /^http_\d+$/.test(result.reason!)) {
    humanReason = `Маркетплейс вернул ошибку (${result.reason!.replace('http_', 'HTTP ')})`
  }

  return NextResponse.json({
    ok: result.status === 'sent',
    status: result.status,
    quantity: result.quantity,
    reason: humanReason,
    logId: result.logId,
  }, { status: result.status === 'sent' ? 200 : result.status === 'blocked' ? 403 : 500 })
})
