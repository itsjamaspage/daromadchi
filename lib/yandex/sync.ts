import { createClient } from '@/lib/supabase/server'
import {
  fetchAllYandexOrders,
  fetchAllYandexProducts,
  fetchAllYandexStocks,
  fetchAllYandexSkuStats,
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
  productsUpserted: number
  campaignsUpserted: number
  error?: string
  details?: string
}

export async function syncFromYandex(
  shopId: string,
  token: string,
  campaignId: string,
  fromDateOverride?: Date,
): Promise<YandexSyncResult> {
  const supabase = await createClient()
  const warnings: string[] = []

  try {
    // Auto-discover businessId (enables business-level offer-mappings endpoint
    // which works even when the campaign integration toggle is off in Yandex portal)
    let businessId: number | undefined
    try {
      const info = await fetchCampaignInfo(token, campaignId)
      if (info.businessId) businessId = info.businessId
    } catch { /* best-effort */ }

    // ── Products (best-effort — don't fail the whole sync if endpoint 404s) ──
    // shopSkuToMarketSku bridges order item offerId (shopSku) → marketSku string
    // so we can resolve product_id even when products.sku is null
    const shopSkuToMarketSku = new Map<string, string>()
    let productRows: {
      shop_id: string; marketplace_product_id: string; title: string; sku: string
      category: string | null; selling_price: number | null; cost_price: null; stock_quantity: number
    }[] = []
    try {
      const entries = await fetchAllYandexProducts(token, campaignId, businessId)
      for (const e of entries) {
        if (e.offer.shopSku && e.mapping?.marketSku) {
          shopSkuToMarketSku.set(e.offer.shopSku, String(e.mapping.marketSku))
        }
      }
      const allSkus = entries.map(e => e.offer.shopSku).filter(Boolean)
      const stockMap = await fetchAllYandexStocks(token, campaignId, allSkus)
      productRows = entries.map(e => ({
        shop_id: shopId,
        marketplace_product_id: String(e.mapping?.marketSku ?? e.offer.shopSku ?? ''),
        title: e.offer.name,
        sku: e.offer.shopSku || String(e.mapping?.marketSku ?? ''),
        category: e.offer.category ?? null,
        selling_price: e.offer.price?.value ?? null,
        cost_price: null,
        stock_quantity: stockMap.get(e.offer.shopSku) ?? 0,
      }))
      if (productRows.length > 0) {
        const { data: existingProds } = await supabase
          .from('products').select('id, marketplace_product_id').eq('shop_id', shopId)
        const existingMap = new Map((existingProds ?? []).map((p: { id: string; marketplace_product_id: string }) =>
          [String(p.marketplace_product_id), String(p.id)]))
        const toIns = productRows.filter(r => !existingMap.has(String(r.marketplace_product_id)))
        const toUpd = productRows.filter(r => existingMap.has(String(r.marketplace_product_id)))
          .map(r => ({ ...r, id: existingMap.get(String(r.marketplace_product_id))! }))
        if (toIns.length > 0) {
          const { error: e } = await supabase.from('products').insert(toIns)
          if (e) throw new Error(`Mahsulot xato: ${e.message}`)
        }
        if (toUpd.length > 0) {
          const { error: e } = await supabase.from('products').upsert(toUpd)
          if (e) throw new Error(`Mahsulot xato: ${e.message}`)
        }
      }
    } catch (prodErr) {
      warnings.push(
        `Products: ${prodErr instanceof YandexApiError
          ? `${prodErr.status} ${prodErr.body?.slice(0, 200) ?? prodErr.message}`
          : String(prodErr)}`
      )
    }

    // ── shopSku→marketSku bridge via SKU stats (fallback when product API omits shopSku) ──
    // YM auto-generates shopSkus like "1743086372-27" that don't appear in the offer-mappings
    // API response but DO appear as offerId in orders. SKU stats API returns both fields.
    if (shopSkuToMarketSku.size === 0) {
      try {
        const today = new Date()
        const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(today.getDate() - 90)
        const stats = await fetchAllYandexSkuStats(
          token, campaignId,
          ninetyDaysAgo.toISOString().slice(0, 10),
          today.toISOString().slice(0, 10),
        )
        for (const stat of stats) {
          if (stat.shopSku && stat.marketSku) {
            shopSkuToMarketSku.set(stat.shopSku, String(stat.marketSku))
          }
        }
      } catch { /* best-effort */ }
    }

    // ── Orders (incremental since last sync, fallback 365 days) ─────────────
    const [{ data: shopRow }, { count: existingProductCount }] = await Promise.all([
      supabase.from('shops').select('last_synced_at').eq('id', shopId).single(),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
    ])

    // Incremental: only fetch orders since last sync to avoid overwriting existing
    // order statuses (which would remove previously-counted revenue from the chart).
    const since = fromDateOverride
      ?? (shopRow?.last_synced_at
        ? new Date(shopRow.last_synced_at)
        : (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d })())

    const fromDate = since.toISOString().slice(0, 10)
    const toDate   = new Date().toISOString().slice(0, 10)

    const yandexOrders = await fetchAllYandexOrders(token, campaignId, fromDate)

    // Yandex returns dates as "dd-MM-yyyy HH:mm:ss" — convert to ISO for Postgres
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

    // Upsert: inserts new orders AND updates status of existing ones
    if (orderRows.length > 0) {
      const { error } = await supabase
        .from('orders')
        .upsert(orderRows, { onConflict: 'shop_id,order_id_external', ignoreDuplicates: false })
      if (error) throw new Error(`Buyurtma xato: ${error.message}`)
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
                selling_price: it.prices?.buyerPrice ?? null,
                cost_price: null,
                stock_quantity: 0,
              })
            }
          }
        }
        if (seenMap.size > 0) {
          const derived = [...seenMap.values()]
          const { data: existingProds } = await supabase
            .from('products').select('id, marketplace_product_id').eq('shop_id', shopId)
          const existingMap = new Map(
            (existingProds ?? []).map((p: { id: string; marketplace_product_id: string }) =>
              [String(p.marketplace_product_id), String(p.id)]),
          )
          const toIns = derived.filter(r => !existingMap.has(r.marketplace_product_id))
          const toUpd = derived
            .filter(r => existingMap.has(r.marketplace_product_id))
            .map(r => ({ ...r, id: existingMap.get(r.marketplace_product_id)! }))
          if (toIns.length > 0) await supabase.from('products').insert(toIns)
          if (toUpd.length > 0) await supabase.from('products').upsert(toUpd)
          productRows.push(...derived)
        }
      } catch { /* best-effort */ }
    }

    // ── Product extraction from API when table is empty and no current batch ──
    // Fetches recent orders from API ONLY for product info — does NOT upsert
    // those orders to the DB so existing order statuses are never overwritten.
    if (productRows.length === 0 && (existingProductCount ?? 0) === 0) {
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
            const { data: ep } = await supabase.from('products').select('id, marketplace_product_id').eq('shop_id', shopId)
            const em = new Map((ep ?? []).map((p: { id: string; marketplace_product_id: string }) => [String(p.marketplace_product_id), String(p.id)]))
            const toIns = derived.filter(r => !em.has(r.marketplace_product_id))
            const toUpd = derived.filter(r => em.has(r.marketplace_product_id)).map(r => ({ ...r, id: em.get(r.marketplace_product_id)! }))
            if (toIns.length > 0) await supabase.from('products').insert(toIns)
            if (toUpd.length > 0) await supabase.from('products').upsert(toUpd)
            productRows.push(...derived)
            // Re-create order_items for these orders already in DB with correct product_ids
            const extIds = extractOrders.map(o => String(o.id))
            const [{ data: dbOrds }, { data: dbProds }] = await Promise.all([
              supabase.from('orders').select('id, order_id_external').eq('shop_id', shopId).in('order_id_external', extIds),
              supabase.from('products').select('id, sku, marketplace_product_id').eq('shop_id', shopId),
            ])
            const oMap = new Map<string, string>(); for (const o of dbOrds ?? []) oMap.set(o.order_id_external as string, o.id as string)
            const pMap = new Map<string, string>()
            for (const p of dbProds ?? []) {
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
              await supabase.from('order_items').delete().in('order_id', dbOids)
              for (let i = 0; i < itmRows.length; i += 500) await supabase.from('order_items').insert(itmRows.slice(i, i + 500))
            }
          }
        }
      } catch { /* best-effort: product extraction is non-fatal */ }
    }

    // ── Order items (best-effort) ─────────────────────────────────────────────
    try {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku, marketplace_product_id, title')
        .eq('shop_id', shopId)
      const skuMap = new Map<string, string>()
      const titleMap = new Map<string, string>()
      for (const p of dbProducts ?? []) {
        if (p.sku) skuMap.set(p.sku as string, p.id as string)
        if (p.marketplace_product_id) skuMap.set(p.marketplace_product_id as string, p.id as string)
        if (p.title) titleMap.set(p.title as string, p.id as string)
      }
      // Bridge: offerId (shopSku) → marketSku → product.id
      for (const [shopSku, marketSkuStr] of shopSkuToMarketSku) {
        const shopSkuStr = String(shopSku)
        if (!skuMap.has(shopSkuStr)) {
          const pid = skuMap.get(marketSkuStr)
          if (pid) skuMap.set(shopSkuStr, pid)
        }
      }

      const extIds = yandexOrders.map(o => String(o.id))
      const { data: dbOrders } = await supabase
        .from('orders')
        .select('id, order_id_external')
        .eq('shop_id', shopId)
        .in('order_id_external', extIds)
      const orderIdMap = new Map<string, string>()
      for (const o of dbOrders ?? []) {
        orderIdMap.set(o.order_id_external as string, o.id as string)
      }

      // Track title-matched (productId → offerId) for post-insert sku backfill
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
          // Primary: match by offerId/sku/marketplace_product_id
          let productId = skuMap.get(offerIdStr) ?? null
          // Fallback: match by offerName = product title (same string from YM catalog)
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
        await supabase.from('order_items').delete().in('order_id', dbOrderIds)
        for (let i = 0; i < itemRows.length; i += 500) {
          await supabase.from('order_items').insert(itemRows.slice(i, i + 500))
        }
      }

      // Backfill product.sku = offerId so future syncs match via skuMap without title lookup
      for (const [productId, offerId] of titleMatchBackfill) {
        await supabase.from('products').update({ sku: offerId }).eq('id', productId)
      }
    } catch { /* order items sync is best-effort */ }

    // ── Advertising ───────────────────────────────────────────────────────────
    // Yandex Market's Partner API does NOT expose advertising statistics — ads
    // are managed in Yandex Direct, a separate product/API. We deliberately do
    // not synthesize ad campaigns from SKU/commission data, because labeling
    // commission as "ad spend" produces misleading DRR/CTR numbers. Real
    // commission and delivery costs are already captured on each order above
    // (marketplace_fee / delivery_cost) and feed the P&L.
    const campaignsUpserted = 0

    // ── Update sync metadata ──────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10)
    await Promise.all([
      supabase.from('shops').update({ last_synced_at: new Date().toISOString() }).eq('id', shopId),
      supabase.from('sync_days').upsert(
        {
          shop_id: shopId,
          sync_date: today,
          status: 'success',
          products_count: productRows.length,
          revenue: newOrderRows.reduce((s, o) => s + (o.revenue ?? 0), 0),
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,sync_date' },
      ),
    ])

    return {
      ok: true,
      ordersUpserted: newOrderRows.length,
      productsUpserted: productRows.length,
      campaignsUpserted,
      details: warnings.length ? warnings.join(' | ') : undefined,
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
      const supabase2 = await createClient()
      await supabase2.from('sync_days').upsert(
        {
          shop_id: shopId,
          sync_date: today,
          status: 'error',
          error_message: msg.slice(0, 500),
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,sync_date' },
      )
    } catch { /* ignore */ }

    return { ok: false, ordersUpserted: 0, productsUpserted: 0, campaignsUpserted: 0, error: msg }
  }
}
