import { createClient } from '@/lib/supabase/server'
import {
  fetchAllYandexOrders,
  fetchAllYandexProducts,
  fetchAllYandexStocks,
  fetchAllYandexSkuStats,
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
}

export async function syncFromYandex(
  shopId: string,
  token: string,
  campaignId: string,
): Promise<YandexSyncResult> {
  const supabase = await createClient()

  try {
    // ── Products (best-effort — don't fail the whole sync if endpoint 404s) ──
    let productRows: {
      shop_id: string; marketplace_product_id: string; title: string; sku: string
      category: string | null; selling_price: number | null; cost_price: null; stock_quantity: number
    }[] = []
    try {
      const entries = await fetchAllYandexProducts(token, campaignId)
      const allSkus = entries.map(e => e.offer.shopSku).filter(Boolean)
      const stockMap = await fetchAllYandexStocks(token, campaignId, allSkus)
      productRows = entries.map(e => ({
        shop_id: shopId,
        marketplace_product_id: String(e.mapping?.marketSku ?? e.offer.shopSku),
        title: e.offer.name,
        sku: e.offer.shopSku,
        category: e.offer.category ?? null,
        selling_price: e.offer.price?.value ?? null,
        cost_price: null,
        stock_quantity: stockMap.get(e.offer.shopSku) ?? 0,
      }))
      if (productRows.length > 0) {
        const { error } = await supabase
          .from('products')
          .upsert(productRows, { onConflict: 'shop_id,marketplace_product_id', ignoreDuplicates: false })
        if (error) throw new Error(`Mahsulot xato: ${error.message}`)
      }
    } catch (prodErr) {
      // Product sync failure must not block order sync
      console.error('Yandex product sync skipped:', prodErr)
    }

    // ── Orders (incremental since last sync, fallback 90 days) ───────────────
    const { data: shopRow } = await supabase
      .from('shops')
      .select('last_synced_at')
      .eq('id', shopId)
      .single()

    const since = shopRow?.last_synced_at
      ? new Date(shopRow.last_synced_at)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d })()

    const fromDate = since.toISOString().slice(0, 10)
    const toDate   = new Date().toISOString().slice(0, 10)

    const yandexOrders = await fetchAllYandexOrders(token, campaignId, fromDate)

    const orderRows = yandexOrders.map(o => ({
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
      ordered_at: o.createdAt,
    }))

    // Upsert: inserts new orders AND updates status of existing ones
    if (orderRows.length > 0) {
      const { error } = await supabase
        .from('orders')
        .upsert(orderRows, { onConflict: 'shop_id,order_id_external', ignoreDuplicates: false })
      if (error) throw new Error(`Buyurtma xato: ${error.message}`)
    }

    const newOrderRows = orderRows

    // ── Order items (best-effort) ─────────────────────────────────────────────
    try {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku')
        .eq('shop_id', shopId)
      const skuMap = new Map<string, string>()
      for (const p of dbProducts ?? []) {
        if (p.sku) skuMap.set(p.sku as string, p.id as string)
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

      const itemRows: {
        order_id: string; product_id: string | null;
        quantity: number; price_per_unit: number
      }[] = []
      for (const o of yandexOrders) {
        const dbOrderId = orderIdMap.get(String(o.id))
        if (!dbOrderId) continue
        for (const it of o.items ?? []) {
          itemRows.push({
            order_id:       dbOrderId,
            product_id:     skuMap.get(it.offerId) ?? null,
            quantity:       it.count,
            price_per_unit: it.prices?.buyerPrice ?? 0,
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
    await supabase
      .from('shops')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', shopId)

    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('sync_days').upsert(
      {
        shop_id: shopId,
        sync_date: today,
        status: 'success',
        products_count: productRows.length,
        revenue: newOrderRows.reduce((s, o) => s + (o.revenue ?? 0), 0),
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,sync_date' },
    )

    return {
      ok: true,
      ordersUpserted: newOrderRows.length,
      productsUpserted: productRows.length,
      campaignsUpserted,
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
