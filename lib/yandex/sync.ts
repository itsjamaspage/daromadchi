import { eq, and, inArray, count } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, syncDays } from '@/lib/db'
import {
  fetchAllYandexOrders,
  fetchAllYandexProducts,
  fetchAllYandexStocks,
  fetchAllYandexSkuStats,
  fetchAllYandexOfferPrices,
  fetchAllYandexCampaignOffers,
  fetchCampaignInfo,
  YandexApiError,
} from './client'

const STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'pending',
  DELIVERY: 'confirmed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
}

export interface YandexSyncResult {
  ok: boolean
  ordersUpserted: number
  // Orders actually INSERTED this run; newOrders = display lines for inserted
  // orders still needing fulfilment. Used for real-time Telegram alerts.
  ordersInserted?: number
  newOrders?: string[]
  productsUpserted: number
  campaignsUpserted: number
  error?: string
  details?: string
  // Structured diagnostic dump — surfaced in the sync toast so users can see
  // which endpoints returned data and which were empty (e.g. offer-mappings
  // returning offers with no basicPrice / no shopSku).
  debug?: Record<string, string | number>
}

export async function syncFromYandex(
  shopId: string,
  token: string,
  campaignId: string,
  fromDateOverride?: Date,
): Promise<YandexSyncResult> {
  const warnings: string[] = []
  const debug: Record<string, string | number> = {}
  let ordersInserted = 0
  const newOrders: string[] = []

  try {
    let businessId: number | undefined
    try {
      const info = await fetchCampaignInfo(token, campaignId)
      if (info.businessId) businessId = info.businessId
      debug.businessId = businessId ?? 0
    } catch (e) {
      debug.campaignInfo = e instanceof YandexApiError ? `${e.status}` : 'err'
    }

    // ── Products (best-effort — don't fail the whole sync if endpoint 404s) ──
    const shopSkuToMarketSku = new Map<string, string>()
    let productRows: {
      shop_id: string; marketplace_product_id: string; title: string; sku: string
      category: string | null; selling_price: number | null; cost_price: null
      // null = Yandex didn't report a stock number for this offer; the sync
      // will preserve the existing DB value instead of writing 0.
      stock_quantity: number | null
    }[] = []
    try {
      const entries = await fetchAllYandexProducts(token, campaignId, businessId)
      debug.offerMappings = entries.length

      // Parse a price from any of the several field shapes YM returns.
      // Values can be number or string; treat 0 as "no price known".
      const num = (v: unknown): number | null => {
        if (v == null) return null
        const n = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(n) && n > 0 ? n : null
      }
      function priceOf(o: typeof entries[0]['offer']): number | null {
        return num(o.basicPrice?.value)
          ?? num(o.cardPrice?.value)
          ?? num(o.price?.value)
          ?? num(o.purchasePrice?.value)
      }
      // shopSku is the canonical seller article; newer responses put it in
      // `offerId` instead — accept either.
      function skuOf(o: typeof entries[0]['offer']): string {
        return (o.shopSku && o.shopSku.trim()) || (o.offerId && o.offerId.trim()) || ''
      }

      let entriesWithPrice = 0
      let entriesWithShopSku = 0
      for (const e of entries) {
        const sku = skuOf(e.offer)
        if (sku && e.mapping?.marketSku) {
          shopSkuToMarketSku.set(sku, String(e.mapping.marketSku))
        }
        if (sku) entriesWithShopSku++
        if (priceOf(e.offer) != null) entriesWithPrice++
      }
      debug.entriesWithShopSku = entriesWithShopSku
      debug.entriesWithPrice = entriesWithPrice

      // Diagnostic: raw first offer so we can see the exact field shape when
      // price/shopSku still come out empty. Strip the pictures array (huge
      // and irrelevant to price/stock diagnosis) before truncating.
      if (entries.length > 0) {
        try {
          const trimmed = JSON.parse(JSON.stringify(entries[0])) as { offer?: { pictures?: unknown }; mapping?: unknown }
          if (trimmed.offer?.pictures) delete trimmed.offer.pictures
          debug.firstOfferRaw = JSON.stringify(trimmed).slice(0, 1500)
        } catch { /* ignore */ }
      }

      // Stocks lookup: try /offers/stocks first (FBS warehouses), fall back
      // to /campaigns/{id}/offers which returns stock inline per offer (works
      // for FBY and sellers who haven't uploaded FBS stock yet). Index by
      // both shopSku and marketSku.
      const allSkus = entries.flatMap(e => [
        skuOf(e.offer),
        e.mapping?.marketSku ? String(e.mapping.marketSku) : '',
      ]).filter(Boolean)
      const stocksResult = await fetchAllYandexStocks(token, campaignId, allSkus)
      const stockMap = stocksResult.stockMap
      debug.stockEntries = stockMap.size
      if (stocksResult.lastError) debug.stocksErr = stocksResult.lastError
      let campaignOfferStocks: Map<string, number> | null = null
      if (stockMap.size === 0) {
        campaignOfferStocks = await fetchAllYandexCampaignOffers(token, campaignId)
        debug.campaignOfferStocks = campaignOfferStocks.size
      }

      // Prices fallback: dedicated offer-prices endpoint. Indexes by both
      // shopSku (offerId) and marketSku so lookups work either way.
      const priceMap = await fetchAllYandexOfferPrices(token, campaignId)
      debug.priceEntries = priceMap.size

      productRows = entries.map(e => {
        const shopSku = skuOf(e.offer)
        const marketSku = e.mapping?.marketSku ? String(e.mapping.marketSku) : ''
        const inlinePrice = priceOf(e.offer)
        const lookupPrice = shopSku
          ? priceMap.get(shopSku) ?? (marketSku ? priceMap.get(marketSku) : null)
          : (marketSku ? priceMap.get(marketSku) : null)
        // Stock priority: FBS warehouses endpoint → campaign offers endpoint →
        // inline offer.stocks (FIT/AVAILABLE totalled across warehouses).
        // null = no source returned data → keep the existing DB value on
        // update so we don't clobber real stock with a spurious 0.
        let inlineStock: number | undefined
        if (Array.isArray(e.offer.stocks) && e.offer.stocks.length > 0) {
          inlineStock = e.offer.stocks
            .filter(s => !s?.type || s.type === 'FIT' || s.type === 'AVAILABLE')
            .reduce((sum, s) => sum + (s?.count ?? 0), 0)
        }
        const stock = (shopSku ? stockMap.get(shopSku) : undefined)
          ?? (marketSku ? stockMap.get(marketSku) : undefined)
          ?? (campaignOfferStocks && shopSku ? campaignOfferStocks.get(shopSku) : undefined)
          ?? (campaignOfferStocks && marketSku ? campaignOfferStocks.get(marketSku) : undefined)
          ?? inlineStock
          ?? null
        return {
          shop_id: shopId,
          marketplace_product_id: String(marketSku || shopSku || ''),
          title: e.offer.name,
          sku: shopSku || marketSku,
          category: e.offer.category ?? null,
          selling_price: inlinePrice ?? lookupPrice ?? null,
          cost_price: null,
          stock_quantity: stock,
        }
      })
      if (productRows.length > 0) {
        const existingProds = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
          .from(products).where(eq(products.shop_id, shopId))
        const existingMap = new Map(existingProds.map(p =>
          [String(p.marketplace_product_id), String(p.id)]))
        const toIns = productRows.filter(r => !existingMap.has(String(r.marketplace_product_id)))
        const toUpd = productRows.filter(r => existingMap.has(String(r.marketplace_product_id)))
          .map(r => ({ ...r, id: existingMap.get(String(r.marketplace_product_id))! }))
        if (toIns.length > 0) {
          await db.insert(products).values(toIns.map(r => ({
            shop_id: r.shop_id,
            marketplace_product_id: r.marketplace_product_id,
            title: r.title,
            sku: r.sku,
            category: r.category,
            selling_price: r.selling_price != null ? String(r.selling_price) : null,
            cost_price: null,
            // Column is NOT NULL — default to 0 on first insert when Yandex
            // didn't report a stock number.
            stock_quantity: r.stock_quantity ?? 0,
          })))
        }
        if (toUpd.length > 0) {
          for (const r of toUpd) {
            // Only overwrite selling_price / stock_quantity when the API
            // actually reported a value — otherwise keep the existing DB
            // value so a silent "endpoint returned nothing" doesn't clobber
            // real data with 0.
            const patch: Record<string, unknown> = {
              marketplace_product_id: r.marketplace_product_id,
              title: r.title,
              sku: r.sku,
              category: r.category,
            }
            if (r.selling_price != null) patch.selling_price = String(r.selling_price)
            if (r.stock_quantity != null) patch.stock_quantity = r.stock_quantity
            await db.update(products).set(patch).where(eq(products.id, r.id))
          }
        }
      }
    } catch (prodErr) {
      const msg = prodErr instanceof YandexApiError
        ? `${prodErr.status} ${prodErr.body?.slice(0, 200) ?? prodErr.message}`
        : String(prodErr)
      warnings.push(`Products: ${msg}`)
      debug.productsErr = prodErr instanceof YandexApiError ? String(prodErr.status) : 'err'
    }

    // ── shopSku→marketSku bridge via SKU stats (fallback when product API omits shopSku) ──
    if (shopSkuToMarketSku.size === 0 && productRows.length > 0) {
      const knownSkus = productRows.map(r => r.sku).filter(Boolean)
      if (knownSkus.length > 0) {
        try {
          const today = new Date()
          const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(today.getDate() - 90)
          const stats = await fetchAllYandexSkuStats(
            token, campaignId, knownSkus,
            ninetyDaysAgo.toISOString().slice(0, 10),
            today.toISOString().slice(0, 10),
          )
          debug.statsRows = stats.length
          const marketSkuToShopSku = new Map<string, string>()
          for (const stat of stats) {
            if (stat.shopSku && stat.marketSku) {
              shopSkuToMarketSku.set(stat.shopSku, String(stat.marketSku))
              marketSkuToShopSku.set(String(stat.marketSku), stat.shopSku)
            }
          }
          // Repair rows whose SKU is a marketSku (numeric) by looking up the
          // real shopSku from stats. This is the case when offer-mappings
          // returned the offer without shopSku.
          let repaired = 0
          for (const r of productRows) {
            const alt = marketSkuToShopSku.get(r.sku)
            if (alt && alt !== r.sku) { r.sku = alt; repaired++ }
          }
          if (repaired > 0) debug.shopSkuRepaired = repaired
        } catch (e) {
          debug.stats = e instanceof YandexApiError ? `${e.status}` : 'err'
        }
      }
    }

    // ── Orders (incremental since last sync, fallback 365 days) ─────────────
    const [shopRows, productCountRows] = await Promise.all([
      db.select({ last_synced_at: shops.last_synced_at }).from(shops).where(eq(shops.id, shopId)),
      db.select({ total: count() }).from(products).where(eq(products.shop_id, shopId)),
    ])
    const shopRow = shopRows[0] ?? null
    const existingProductCount = productCountRows[0]?.total ?? 0

    const since = fromDateOverride
      ?? (shopRow?.last_synced_at
        ? new Date(shopRow.last_synced_at)
        : (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d })())

    const fromDate = since.toISOString().slice(0, 10)

    const yandexOrders = await fetchAllYandexOrders(token, campaignId, fromDate)

    function parseYandexDate(raw?: string): string | null {
      if (!raw) return null
      const m = raw.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)
      if (!m) return null
      const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6])
      return isNaN(d.getTime()) ? null : d.toISOString()
    }

    const orderRows = yandexOrders
      .map(o => ({ o, orderedAt: parseYandexDate(o.creationDate) ?? parseYandexDate(o.updatedAt) }))
      .filter((row): row is typeof row & { orderedAt: string } => row.orderedAt !== null)
      .map(({ o, orderedAt }) => ({
        shop_id: shopId,
        order_id_external: String(o.id),
        marketplace: 'yandex_market' as const,
        status: (STATUS_MAP[o.status] ?? 'pending') as
          | 'pending'
          | 'confirmed'
          | 'delivered'
          | 'cancelled'
          | 'returned',
        revenue: o.buyerTotal ?? o.itemsTotal ?? 0,
        marketplace_fee: o.commissionTotal ?? null,
        delivery_cost: o.deliveryTotal ?? null,
        items_count: o.items?.length ?? 1,
        ordered_at: orderedAt,
      }))

    if (orderRows.length > 0) {
      const extIds = orderRows.map(r => r.order_id_external)
      const existingOrders = await db.select({ id: orders.id, order_id_external: orders.order_id_external })
        .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds)))
      const existingOrderMap = new Map(existingOrders.map(o => [o.order_id_external, o.id]))

      const toInsert = orderRows.filter(r => !existingOrderMap.has(r.order_id_external))
      const toUpdate = orderRows.filter(r => existingOrderMap.has(r.order_id_external))
      ordersInserted = toInsert.length
      for (const r of toInsert) {
        if (r.status === 'pending' || r.status === 'confirmed') {
          newOrders.push(`#${r.order_id_external} — ${r.revenue ?? 0} so'm, ${r.items_count} dona`)
        }
      }

      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += 500) {
          await db.insert(orders).values(toInsert.slice(i, i + 500).map(r => ({
            shop_id: r.shop_id,
            order_id_external: r.order_id_external,
            marketplace: r.marketplace,
            status: r.status,
            revenue: r.revenue != null ? String(r.revenue) : null,
            marketplace_fee: r.marketplace_fee != null ? String(r.marketplace_fee) : null,
            delivery_cost: r.delivery_cost != null ? String(r.delivery_cost) : null,
            items_count: r.items_count,
            ordered_at: new Date(r.ordered_at),
          })))
        }
      }
      for (const r of toUpdate) {
        await db.update(orders).set({
          status: r.status,
          revenue: r.revenue != null ? String(r.revenue) : null,
          marketplace_fee: r.marketplace_fee != null ? String(r.marketplace_fee) : null,
          delivery_cost: r.delivery_cost != null ? String(r.delivery_cost) : null,
          items_count: r.items_count,
          ordered_at: new Date(r.ordered_at),
        }).where(eq(orders.id, existingOrderMap.get(r.order_id_external)!))
      }
    }

    const newOrderRows = orderRows

    // ── Derive products from order items if product sync returned nothing ────
    if (productRows.length === 0 && yandexOrders.length > 0) {
      try {
        const seenMap = new Map<string, typeof productRows[0]>()
        for (const o of yandexOrders) {
          for (const it of o.items ?? []) {
            const mpid = it.offerId
            if (!seenMap.has(mpid)) {
              seenMap.set(mpid, {
                shop_id: shopId,
                marketplace_product_id: mpid,
                title: it.offerName ?? `SKU ${mpid}`,
                sku: mpid,
                category: null,
                selling_price: it.buyerPrice ?? it.price ?? null,
                cost_price: null,
                stock_quantity: 0,
              })
            }
          }
        }
        if (seenMap.size > 0) {
          const derived = [...seenMap.values()]
          const existingProds = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
            .from(products).where(eq(products.shop_id, shopId))
          const existingMap = new Map(
            existingProds.map(p => [String(p.marketplace_product_id), String(p.id)]),
          )
          const toIns = derived.filter(r => !existingMap.has(r.marketplace_product_id))
          const toUpd = derived
            .filter(r => existingMap.has(r.marketplace_product_id))
            .map(r => ({ ...r, id: existingMap.get(r.marketplace_product_id)! }))
          if (toIns.length > 0) {
            await db.insert(products).values(toIns.map(r => ({
              shop_id: r.shop_id,
              marketplace_product_id: r.marketplace_product_id,
              title: r.title,
              sku: r.sku,
              category: r.category,
              selling_price: r.selling_price != null ? String(r.selling_price) : null,
              cost_price: null,
              stock_quantity: r.stock_quantity ?? 0,
            })))
          }
          if (toUpd.length > 0) {
            for (const r of toUpd) {
              // Derived-from-orders path: we don't know stock, so leave the
              // existing DB stock_quantity untouched instead of writing 0.
              const patch: Record<string, unknown> = {
                marketplace_product_id: r.marketplace_product_id,
                title: r.title,
                sku: r.sku,
                category: r.category,
              }
              if (r.selling_price != null) patch.selling_price = String(r.selling_price)
              await db.update(products).set(patch).where(eq(products.id, r.id))
            }
          }
          productRows.push(...derived)
        }
      } catch { /* best-effort */ }
    }

    // ── Product extraction from API when table is empty and no current batch ──
    if (productRows.length === 0 && existingProductCount === 0) {
      try {
        const extractFrom = new Date(); extractFrom.setDate(extractFrom.getDate() - 90)
        const extractOrders = await fetchAllYandexOrders(token, campaignId, extractFrom.toISOString().slice(0, 10))
          .catch(() => [] as typeof yandexOrders)
        if (extractOrders.length > 0) {
          const seenMap = new Map<string, typeof productRows[0]>()
          for (const o of extractOrders) {
            for (const it of o.items ?? []) {
              if (!seenMap.has(it.offerId)) {
                seenMap.set(it.offerId, {
                  shop_id: shopId, marketplace_product_id: it.offerId,
                  title: it.offerName ?? `SKU ${it.offerId}`,
                  sku: it.offerId, category: null,
                  selling_price: it.buyerPrice ?? it.price ?? null, cost_price: null, stock_quantity: 0,
                })
              }
            }
          }
          if (seenMap.size > 0) {
            const derived = [...seenMap.values()]
            const ep = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
              .from(products).where(eq(products.shop_id, shopId))
            const em = new Map(ep.map(p => [String(p.marketplace_product_id), String(p.id)]))
            const toIns = derived.filter(r => !em.has(r.marketplace_product_id))
            const toUpd = derived.filter(r => em.has(r.marketplace_product_id)).map(r => ({ ...r, id: em.get(r.marketplace_product_id)! }))
            if (toIns.length > 0) {
              await db.insert(products).values(toIns.map(r => ({
                shop_id: r.shop_id,
                marketplace_product_id: r.marketplace_product_id,
                title: r.title,
                sku: r.sku,
                category: r.category,
                selling_price: r.selling_price != null ? String(r.selling_price) : null,
                cost_price: null,
                stock_quantity: r.stock_quantity ?? 0,
              })))
            }
            if (toUpd.length > 0) {
              for (const r of toUpd) {
                // Extraction path: derived from historical orders, so we
                // don't know current stock — keep the existing DB value.
                const patch: Record<string, unknown> = {
                  marketplace_product_id: r.marketplace_product_id,
                  title: r.title,
                  sku: r.sku,
                  category: r.category,
                }
                if (r.selling_price != null) patch.selling_price = String(r.selling_price)
                await db.update(products).set(patch).where(eq(products.id, r.id))
              }
            }
            productRows.push(...derived)
            const extIds = extractOrders.map(o => String(o.id))
            const [dbOrds, dbProds] = await Promise.all([
              db.select({ id: orders.id, order_id_external: orders.order_id_external })
                .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds))),
              db.select({ id: products.id, sku: products.sku, marketplace_product_id: products.marketplace_product_id })
                .from(products).where(eq(products.shop_id, shopId)),
            ])
            const oMap = new Map<string, string>(); for (const o of dbOrds) oMap.set(o.order_id_external as string, o.id as string)
            const pMap = new Map<string, string>()
            for (const p of dbProds) {
              if (p.sku) pMap.set(p.sku as string, p.id as string)
              if (p.marketplace_product_id) pMap.set(p.marketplace_product_id as string, p.id as string)
            }
            const itmRows: { order_id: string; product_id: string | null; quantity: number; price_per_unit: number }[] = []
            for (const o of extractOrders) {
              const dbOid = oMap.get(String(o.id))
              if (!dbOid) continue
              for (const it of o.items ?? []) {
                itmRows.push({ order_id: dbOid, product_id: pMap.get(it.offerId) ?? null, quantity: it.count, price_per_unit: it.buyerPrice ?? it.price ?? 0 })
              }
            }
            if (itmRows.length > 0) {
              const dbOids = [...new Set(itmRows.map(r => r.order_id))]
              await db.delete(orderItems).where(inArray(orderItems.order_id, dbOids))
              for (let i = 0; i < itmRows.length; i += 500) {
                await db.insert(orderItems).values(itmRows.slice(i, i + 500).map(r => ({
                  order_id: r.order_id,
                  product_id: r.product_id,
                  quantity: r.quantity,
                  price_per_unit: String(r.price_per_unit),
                })))
              }
            }
          }
        }
      } catch { /* best-effort: product extraction is non-fatal */ }
    }

    // ── Order items (best-effort) ─────────────────────────────────────────────
    try {
      const dbProducts = await db.select({ id: products.id, sku: products.sku, marketplace_product_id: products.marketplace_product_id, title: products.title })
        .from(products).where(eq(products.shop_id, shopId))
      const skuMap = new Map<string, string>()
      const titleMap = new Map<string, string>()
      for (const p of dbProducts) {
        if (p.sku) skuMap.set(p.sku as string, p.id as string)
        if (p.marketplace_product_id) skuMap.set(p.marketplace_product_id as string, p.id as string)
        if (p.title) titleMap.set(p.title as string, p.id as string)
      }
      for (const [shopSku, marketSkuStr] of shopSkuToMarketSku) {
        const shopSkuStr = String(shopSku)
        if (!skuMap.has(shopSkuStr)) {
          const pid = skuMap.get(marketSkuStr)
          if (pid) skuMap.set(shopSkuStr, pid)
        }
      }

      const extIds = yandexOrders.map(o => String(o.id))
      const dbOrders = await db.select({ id: orders.id, order_id_external: orders.order_id_external })
        .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds)))
      const orderIdMap = new Map<string, string>()
      for (const o of dbOrders) {
        orderIdMap.set(o.order_id_external as string, o.id as string)
      }

      const titleMatchBackfill = new Map<string, string>()

      const itemRows: {
        order_id: string; product_id: string | null;
        quantity: number; price_per_unit: number
      }[] = []
      for (const o of yandexOrders) {
        const dbOrderId = orderIdMap.get(String(o.id))
        if (!dbOrderId) continue
        for (const it of o.items ?? []) {
          const offerIdStr = String(it.offerId)
          let productId = skuMap.get(offerIdStr) ?? null
          if (!productId && it.offerName) {
            productId = titleMap.get(it.offerName) ?? null
            if (productId) titleMatchBackfill.set(productId, offerIdStr)
          }
          itemRows.push({
            order_id:       dbOrderId,
            product_id:     productId,
            quantity:       it.count,
            price_per_unit: it.prices?.find(p => p.type === 'BUYER')?.costPerItem
              ?? it.prices?.find(p => p.type === 'PARTNER')?.costPerItem
              ?? it.buyerPrice
              ?? it.price
              ?? 0,
          })
        }
      }

      if (itemRows.length > 0) {
        const dbOrderIds = [...new Set(itemRows.map(r => r.order_id))]
        await db.delete(orderItems).where(inArray(orderItems.order_id, dbOrderIds))
        for (let i = 0; i < itemRows.length; i += 500) {
          await db.insert(orderItems).values(itemRows.slice(i, i + 500).map(r => ({
            order_id: r.order_id,
            product_id: r.product_id,
            quantity: r.quantity,
            price_per_unit: String(r.price_per_unit),
          })))
        }
      }

      if (titleMatchBackfill.size > 0) {
        for (const [productId, offerId] of titleMatchBackfill) {
          await db.update(products).set({ sku: offerId }).where(eq(products.id, productId))
        }
      }
    } catch { /* order items sync is best-effort */ }

    // ── Advertising ───────────────────────────────────────────────────────────
    const campaignsUpserted = 0

    // ── Update sync metadata ──────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10)
    await Promise.all([
      db.update(shops).set({ last_synced_at: new Date() }).where(eq(shops.id, shopId)),
      db.insert(syncDays).values({
        shop_id: shopId,
        sync_date: today,
        status: 'success',
        products_count: productRows.length,
        revenue: String(newOrderRows.reduce((s, o) => s + (o.revenue ?? 0), 0)),
        synced_at: new Date(),
      }).onConflictDoUpdate({
        target: [syncDays.shop_id, syncDays.sync_date],
        set: {
          status: 'success',
          products_count: productRows.length,
          revenue: String(newOrderRows.reduce((s, o) => s + (o.revenue ?? 0), 0)),
          synced_at: new Date(),
        },
      }),
    ])

    debug.orders = yandexOrders.length
    return {
      ok: true,
      ordersUpserted: newOrderRows.length,
      ordersInserted,
      newOrders,
      productsUpserted: productRows.length,
      campaignsUpserted,
      details: warnings.length ? warnings.join(' | ') : undefined,
      debug,
    }
  } catch (err) {
    const msg =
      err instanceof YandexApiError
        ? `Yandex API xatosi ${err.status}: ${err.message}${err.body ? `\n${err.body.slice(0, 200)}` : ''}`
        : err instanceof Error
          ? err.message
          : "Noma'lum xato"

    try {
      const today = new Date().toISOString().slice(0, 10)
      await db.insert(syncDays).values({
        shop_id: shopId,
        sync_date: today,
        status: 'error',
        error_message: msg.slice(0, 500),
        synced_at: new Date(),
      }).onConflictDoUpdate({
        target: [syncDays.shop_id, syncDays.sync_date],
        set: {
          status: 'error',
          error_message: msg.slice(0, 500),
          synced_at: new Date(),
        },
      })
    } catch { /* ignore */ }

    return { ok: false, ordersUpserted: 0, productsUpserted: 0, campaignsUpserted: 0, error: msg }
  }
}
