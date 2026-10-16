import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products, productGroupMerges } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { pushStock } from '@/lib/marketplace/stock-writer'
import { backfillShopIdentifiers } from '@/lib/marketplace/identifier-backfill'
import { decrypt } from '@/lib/crypto'
import { fetchAllUzumSkuStocks } from '@/lib/uzum/client'
import { buildKeyResolver, matchKeyForProduct } from '@/lib/db/group-key'
import { readLedgerEventsForKey, isSeeded, appendManualStockEdit } from '@/lib/marketplace/stock-ledger-db'
import { ledgerOnHand } from '@/lib/marketplace/stock-ledger'
import { syncStockSyncGroups } from '@/lib/marketplace/stock-sync'
import { logger } from '@/lib/logger'
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

  let [product] = await db.select({
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

  const needsBackfill =
    (marketplace === 'yandex_market' && (!product.market_sku || !product.market_warehouse_id)) ||
    (marketplace === 'uzum' && (!product.market_barcode || !product.market_sku))
  if (needsBackfill) {
    await backfillShopIdentifiers({
      id: shop.id,
      marketplace,
      api_key_encrypted: shop.api_key_encrypted,
      shop_id_external: shop.shop_id_external,
    })
    const [refreshed] = await db.select({
      id: products.id,
      shop_id: products.shop_id,
      sku: products.sku,
      market_barcode: products.market_barcode,
      market_sku: products.market_sku,
      market_warehouse_id: products.market_warehouse_id,
    }).from(products).where(eq(products.id, product.id))
    if (refreshed) product = refreshed
  }

  let uzumFbsLinked: boolean | undefined
  let uzumDbsLinked: boolean | undefined
  if (marketplace === 'uzum' && product.market_barcode && shop.api_key_encrypted) {
    const token = decrypt(shop.api_key_encrypted)
    try {
      const stocks = await fetchAllUzumSkuStocks(token)
      const rec = stocks.find(s => String(s.barcode ?? '').trim() === product.market_barcode!.trim())
      if (rec) {
        if (rec.fbsLinked === false) {
          return NextResponse.json({
            ok: false,
            status: 'skipped',
            reason: 'Товар не привязан к FBS-складу в Uzum. Привяжите товар в кабинете продавца.',
          }, { status: 400 })
        }
        uzumFbsLinked = rec.fbsLinked
        uzumDbsLinked = rec.dbsLinked === true
      }
    } catch { /* best-effort: proceed with defaults if the read fails */ }
  }

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
    uzumFbsLinked,
    uzumDbsLinked,
    quantity: Math.trunc(quantity),
    version: Date.now(),
    warehouseId: product.market_warehouse_id,
    productId: product.id,
  })

  if (result.status === 'sent') {
    const newQty = result.quantity

    // Update this product: stock_quantity, stock_override, AND physical_stock.
    // physical_stock is the pool the automated sync uses — without updating it,
    // the next sync run computes MAX(stale physical_stock) and reverts the edit.
    await db.update(products)
      .set({ stock_quantity: newQty, stock_override: newQty, physical_stock: newQty })
      .where(eq(products.id, product.id))

    // Propagate to same-group siblings and adjust the ledger so the automated
    // sync never overwrites this manual edit.
    const mergeRows = await db.select({
      source_key: productGroupMerges.source_key,
      target_key: productGroupMerges.target_key,
    }).from(productGroupMerges).where(eq(productGroupMerges.user_id, user.id))
    const resolveKey = buildKeyResolver(mergeRows)
    const matchKey = matchKeyForProduct(product.sku, product.id, resolveKey)

    // Update physical_stock on all group siblings (same SKU, other shops) so
    // MAX(physical_stock) across the group reflects the new value.
    const allUserProducts = await db.select({ id: products.id, sku: products.sku })
      .from(products)
      .where(inArray(products.shop_id, shopIds))
    const siblingIds = allUserProducts
      .filter(p => p.id !== product.id && matchKeyForProduct(p.sku, p.id, resolveKey) === matchKey)
      .map(p => p.id)
    if (siblingIds.length > 0) {
      await db.update(products)
        .set({ physical_stock: newQty })
        .where(inArray(products.id, siblingIds))
    }

    // Adjust the ledger: for FBS groups the sync uses on_hand (not physical_stock),
    // so the ledger must also reflect the manual edit.
    const events = await readLedgerEventsForKey(user.id, matchKey)
    if (isSeeded(events)) {
      const currentOnHand = ledgerOnHand(events)
      const delta = newQty - currentOnHand
      if (delta !== 0) {
        await appendManualStockEdit(
          user.id, matchKey, delta,
          `manual_edit qty=${newQty} prev_on_hand=${currentOnHand}`,
        )
      }
    }

    // Fire-and-forget: run a targeted sync for this group to push the new value
    // to the other marketplace immediately (instead of waiting for the next cron).
    syncStockSyncGroups({ userId: user.id, onlyMatchKey: matchKey })
      .catch(err => logger.warn('manual_edit_cross_sync_failed', {
        productId: product.id, error: String(err).slice(0, 200),
      }))

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
    uzum_body_error: 'Uzum вернул ошибку в теле ответа (HTTP 200). Проверьте данные товара.',
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
