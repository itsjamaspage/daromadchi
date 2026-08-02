/**
 * Populates the stock-WRITE identifiers on `products` from READ-only endpoints:
 *   • Uzum → market_barcode (string barcode from GET /v3/fbs/sku/stocks)
 *   • Yandex Market → market_sku (shopSku) + market_warehouse_id (from the
 *     offers/stocks read + FBS warehouses)
 *
 * This module ONLY reads marketplaces and writes to our own DB — it never calls
 * the stock-writer and can never fire a live store write. It is the first of the
 * three gates: backfill runs (all shops still in dry-run), then you verify the
 * identifiers are populated, and only then does a shop flip to live.
 */

import { eq } from 'drizzle-orm'
import { db, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { fetchAllUzumSkuStocks } from '@/lib/uzum/client'
import { fetchYandexStockLocations } from '@/lib/yandex/client'
import type { MarketplaceType } from '@/lib/types'

export interface BackfillShop {
  id: string
  marketplace: MarketplaceType
  api_key_encrypted: string | null
  shop_id_external?: string | null
}

export interface BackfillResult {
  shopId: string
  marketplace: MarketplaceType
  totalProducts: number
  matched: number
  updated: number
  /** Products still missing the identifier needed for a write, after backfill. */
  missingAfter: number
  error?: string
}

function nonBlank(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

export async function backfillShopIdentifiers(shop: BackfillShop): Promise<BackfillResult> {
  const base: BackfillResult = {
    shopId: shop.id, marketplace: shop.marketplace,
    totalProducts: 0, matched: 0, updated: 0, missingAfter: 0,
  }
  if (!shop.api_key_encrypted) return { ...base, error: 'no_token' }

  const token = decrypt(shop.api_key_encrypted)
  const rows = await db.select({
    id: products.id,
    sku: products.sku,
    mpid: products.marketplace_product_id,
    barcode: products.market_barcode,
    marketSku: products.market_sku,
    warehouseId: products.market_warehouse_id,
  }).from(products).where(eq(products.shop_id, shop.id))
  base.totalProducts = rows.length

  try {
    if (shop.marketplace === 'uzum') {
      const stocks = await fetchAllUzumSkuStocks(token)
      // Index barcode by every identifier the record might carry.
      const barcodeByKey = new Map<string, string>()
      for (const s of stocks) {
        const bc = nonBlank(s.barcode)
        if (!bc) continue
        for (const key of [s.skuId, s.sku, s.sellerSku, s.sellerSkuCode, s.sellerItemCode, s.article]) {
          const k = nonBlank(key)
          if (k) barcodeByKey.set(k, bc)
        }
      }
      for (const p of rows) {
        const bc = (p.mpid && barcodeByKey.get(String(p.mpid).trim())) || (p.sku && barcodeByKey.get(p.sku.trim()))
        if (!bc) continue
        base.matched++
        if (p.barcode !== bc) {
          await db.update(products).set({ market_barcode: bc }).where(eq(products.id, p.id))
          base.updated++
        }
      }
      base.missingAfter = rows.filter(p => !(p.barcode || barcodeByKey.get(String(p.mpid).trim()) || (p.sku && barcodeByKey.get(p.sku.trim())))).length
    } else if (shop.marketplace === 'yandex_market') {
      const campaignId = nonBlank(shop.shop_id_external)
      if (!campaignId) return { ...base, error: 'no_campaign_id' }
      const locations = await fetchYandexStockLocations(token, campaignId)
      for (const p of rows) {
        // YM stores the shopSku in products.sku; it's also the offers/stocks key.
        const shopSku = nonBlank(p.sku) ?? nonBlank(p.mpid)
        const loc = (p.sku && locations.get(p.sku.trim())) || (p.mpid && locations.get(String(p.mpid).trim()))
        if (!shopSku || !loc) continue
        base.matched++
        const wh = String(loc.warehouseId)
        if (p.marketSku !== shopSku || p.warehouseId !== wh) {
          await db.update(products).set({ market_sku: shopSku, market_warehouse_id: wh }).where(eq(products.id, p.id))
          base.updated++
        }
      }
      base.missingAfter = rows.filter(p => {
        const has = (p.marketSku && p.warehouseId) || ((p.sku && locations.get(p.sku.trim())) || (p.mpid && locations.get(String(p.mpid).trim())))
        return !has
      }).length
    } else {
      return { ...base, error: 'marketplace_out_of_scope' }
    }
  } catch (err) {
    logger.error('identifier_backfill_failed', { shopId: shop.id, marketplace: shop.marketplace, error: String(err).slice(0, 300) })
    return { ...base, error: String(err).slice(0, 300) }
  }

  logger.info('identifier_backfill', { ...base })
  return base
}
