import { createClient } from '@/lib/supabase/server'
import {
  fetchUzumShops,
  fetchAllUzumProducts,
  fetchAllUzumFinanceOrders,
  UzumApiError,
} from './client'

const STATUS_MAP: Record<string, string> = {
  TO_WITHDRAW:          'delivered',
  PROCESSING:           'confirmed',
  CANCELED:             'cancelled',
  PARTIALLY_CANCELLED:  'cancelled',
}

export interface SyncResult {
  ok: boolean
  ordersUpserted: number
  productsUpserted: number
  error?: string
}

export async function syncFromUzum(shopId: string, token: string): Promise<SyncResult> {
  const supabase = await createClient()

  try {
    // ── Resolve Uzum numeric shop ID ──────────────────────────────────────────
    const shops = await fetchUzumShops(token)
    if (!shops.length) throw new Error('Uzum API: hech qanday do\'kon topilmadi')
    const uzumShopId = shops[0].id

    // ── Sync products ──────────────────────────────────────────────────────────
    const uzumProducts = await fetchAllUzumProducts(token, uzumShopId)

    const productRows = uzumProducts.map(p => {
      const sku0 = p.skuList?.[0]
      const stock = (p.skuList ?? []).reduce(
        (s, sku) => s + (sku.quantityActive ?? 0) + (sku.quantityFbs ?? 0), 0
      )
      return {
        shop_id:                shopId,
        marketplace_product_id: String(p.productId),
        title:                  p.title ?? String(p.productId),
        sku:                    String(sku0?.skuId ?? p.productId),
        category:               p.category ?? null,
        selling_price:          sku0?.price ?? 0,
        cost_price:             sku0?.purchasePrice ?? 0,
        stock_quantity:         stock,
      }
    })

    await supabase.from('products').delete().eq('shop_id', shopId)
    if (productRows.length > 0) {
      const { error: prodErr } = await supabase.from('products').insert(productRows)
      if (prodErr) throw new Error(`Mahsulotlarni saqlashda xato: ${prodErr.message}`)
    }

    // ── Sync orders (last 90 days) ────────────────────────────────────────────
    const now  = Date.now()
    const from = now - 90 * 86400000

    const orderItems = await fetchAllUzumFinanceOrders(token, {
      shopId:   uzumShopId,
      dateFrom: from,
      dateTo:   now,
      group:    false,
    })

    const { data: existing } = await supabase
      .from('orders')
      .select('order_id_external')
      .eq('shop_id', shopId)

    const existingIds = new Set((existing ?? []).map((o: { order_id_external: string | null }) => o.order_id_external))

    // Each SellerOrderItemDto is one line item; group by orderId
    const orderMap = new Map<number, typeof orderItems[number][]>()
    for (const item of orderItems) {
      if (!orderMap.has(item.orderId)) orderMap.set(item.orderId, [])
      orderMap.get(item.orderId)!.push(item)
    }

    const newOrderRows: {
      shop_id: string
      order_id_external: string
      marketplace: 'uzum'
      status: 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'returned'
      revenue: number
      marketplace_fee: number
      delivery_cost: number
      items_count: number
      ordered_at: string
    }[] = []

    for (const [orderId, items] of orderMap) {
      const extId = String(orderId)
      if (existingIds.has(extId)) continue

      const revenue          = items.reduce((s, i) => s + i.sellerPrice, 0)
      const marketplace_fee  = items.reduce((s, i) => s + i.commission, 0)
      const delivery_cost    = items.reduce((s, i) => s + i.logisticDeliveryFee, 0)
      // Use the status of the first item (all items in an order share status)
      const rawStatus = items[0].status
      const status = (STATUS_MAP[rawStatus] ?? 'pending') as
        'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'returned'

      newOrderRows.push({
        shop_id:           shopId,
        order_id_external: extId,
        marketplace:       'uzum',
        status,
        revenue,
        marketplace_fee,
        delivery_cost,
        items_count:       items.reduce((s, i) => s + i.amount, 0),
        ordered_at:        new Date(items[0].date).toISOString(),
      })
    }

    if (newOrderRows.length > 0) {
      const { error: ordErr } = await supabase.from('orders').insert(newOrderRows)
      if (ordErr) throw new Error(`Buyurtmalarni saqlashda xato: ${ordErr.message}`)
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
    const msg = err instanceof UzumApiError
      ? `Uzum API: ${err.status} — ${err.message}`
      : err instanceof Error ? err.message : 'Noma\'lum xato'
    return { ok: false, ordersUpserted: 0, productsUpserted: 0, error: msg }
  }
}
