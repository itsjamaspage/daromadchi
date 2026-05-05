import { createClient } from '@/lib/supabase/server'
import { fetchAllYandexOrders, fetchAllYandexProducts, YandexApiError } from './client'

const STATUS_MAP: Record<string, string> = {
  PENDING:    'pending',
  PROCESSING: 'pending',
  DELIVERY:   'confirmed',
  DELIVERED:  'delivered',
  CANCELLED:  'cancelled',
  RETURNED:   'returned',
}

export interface YandexSyncResult {
  ok: boolean
  ordersUpserted: number
  productsUpserted: number
  error?: string
}

export async function syncFromYandex(shopId: string, token: string, campaignId: string): Promise<YandexSyncResult> {
  const supabase = await createClient()

  try {
    // ── Products ──────────────────────────────────────────────────────────────
    const entries = await fetchAllYandexProducts(token, campaignId)

    const productRows = entries.map(e => ({
      shop_id:                shopId,
      marketplace_product_id: String(e.mapping?.marketSku ?? e.offer.shopSku),
      title:                  e.offer.name,
      sku:                    e.offer.shopSku,
      category:               e.offer.category ?? null,
      selling_price:          e.offer.price?.value ?? null,
      cost_price:             null,          // not provided by Yandex API
      stock_quantity:         0,             // stock requires separate endpoint
    }))

    await supabase.from('products').delete().eq('shop_id', shopId)
    if (productRows.length > 0) {
      const { error } = await supabase.from('products').insert(productRows)
      if (error) throw new Error(`Mahsulot xato: ${error.message}`)
    }

    // ── Orders (last 90 days) ─────────────────────────────────────────────────
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const fromDate = since.toISOString().slice(0, 10)

    const yandexOrders = await fetchAllYandexOrders(token, campaignId, fromDate)

    const { data: existing } = await supabase
      .from('orders')
      .select('order_id_external')
      .eq('shop_id', shopId)

    const existingIds = new Set((existing ?? []).map(o => o.order_id_external))

    const newOrderRows = yandexOrders
      .filter(o => !existingIds.has(String(o.id)))
      .map(o => ({
        shop_id:           shopId,
        order_id_external: String(o.id),
        marketplace:       'yandex_market' as const,
        status:            (STATUS_MAP[o.status] ?? 'pending') as 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'returned',
        revenue:           o.buyerTotal ?? o.itemsTotal ?? 0,
        marketplace_fee:   o.commissionTotal ?? null,
        delivery_cost:     o.deliveryTotal ?? null,
        items_count:       o.items?.length ?? 1,
        ordered_at:        o.createdAt,
      }))

    if (newOrderRows.length > 0) {
      const { error } = await supabase.from('orders').insert(newOrderRows)
      if (error) throw new Error(`Buyurtma xato: ${error.message}`)
    }

    await supabase
      .from('shops')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', shopId)

    return {
      ok:               true,
      ordersUpserted:   newOrderRows.length,
      productsUpserted: productRows.length,
    }
  } catch (err) {
    const msg = err instanceof YandexApiError
      ? `Yandex API: ${err.status} — ${err.message}`
      : err instanceof Error ? err.message : 'Noma\'lum xato'
    return { ok: false, ordersUpserted: 0, productsUpserted: 0, error: msg }
  }
}
