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
    // ── Products ──────────────────────────────────────────────────────────────
    const entries = await fetchAllYandexProducts(token, campaignId)
    const allSkus = entries.map(e => e.offer.shopSku).filter(Boolean)

    // Fetch FBS stock quantities (best-effort)
    const stockMap = await fetchAllYandexStocks(token, campaignId, allSkus)

    const productRows = entries.map(e => ({
      shop_id: shopId,
      marketplace_product_id: String(e.mapping?.marketSku ?? e.offer.shopSku),
      title: e.offer.name,
      sku: e.offer.shopSku,
      category: e.offer.category ?? null,
      selling_price: e.offer.price?.value ?? null,
      cost_price: null, // not provided by Yandex offer mapping API
      stock_quantity: stockMap.get(e.offer.shopSku) ?? 0,
    }))

    if (productRows.length > 0) {
      const { error } = await supabase
        .from('products')
        .upsert(productRows, { onConflict: 'shop_id,marketplace_product_id', ignoreDuplicates: false })
      if (error) throw new Error(`Mahsulot xato: ${error.message}`)
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

    const { data: existing } = await supabase
      .from('orders')
      .select('order_id_external')
      .eq('shop_id', shopId)

    const existingIds = new Set((existing ?? []).map(o => o.order_id_external))

    const newOrderRows = yandexOrders
      .filter(o => !existingIds.has(String(o.id)))
      .map(o => ({
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

    if (newOrderRows.length > 0) {
      const { error } = await supabase.from('orders').insert(newOrderRows)
      if (error) throw new Error(`Buyurtma xato: ${error.message}`)
    }

    // ── SKU stats → ad_campaigns proxy (best-effort) ──────────────────────────
    // Yandex doesn't expose a simple "campaign list" endpoint in v2.
    // We derive ad campaign records from SKU-level stats as a best approximation.
    let campaignsUpserted = 0
    try {
      const skuStats = await fetchAllYandexSkuStats(token, campaignId, fromDate, toDate)

      if (skuStats.length > 0) {
        const statsRows = skuStats
          .filter(s => s.ordersCount > 0 || s.grossRevenue > 0)
          .map(s => ({
            shop_id: shopId,
            marketplace_campaign_id: `ym-sku-${s.shopSku}`,
            name: s.name ?? s.shopSku,
            type: 'cpo',
            status: 'active',
            product_title: s.name ?? s.shopSku,
            spend: s.commissionRevenue ?? 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            orders: s.ordersCount ?? 0,
            revenue: s.grossRevenue ?? 0,
            drr: s.grossRevenue > 0 ? ((s.commissionRevenue ?? 0) / s.grossRevenue) * 100 : 0,
            start_date: fromDate,
          }))

        if (statsRows.length > 0) {
          const { error } = await supabase
            .from('ad_campaigns')
            .upsert(statsRows, { onConflict: 'shop_id,marketplace_campaign_id', ignoreDuplicates: false })
          if (!error) campaignsUpserted = statsRows.length
        }
      }
    } catch {
      // Stats sync is best-effort
    }

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
