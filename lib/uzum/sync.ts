import { createClient } from '@/lib/supabase/server'
import {
  fetchAllPages,
  fetchUzumOrders,
  fetchUzumProducts,
  UzumApiError,
} from './client'

const STATUS_MAP: Record<string, string> = {
  PROCESSING: 'pending',
  SHIPPED:    'confirmed',
  DELIVERED:  'delivered',
  CANCELLED:  'cancelled',
  RETURNED:   'returned',
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
    // ── Sync products ──────────────────────────────────────────────────────────
    const uzumProducts = await fetchAllPages(page => fetchUzumProducts(token, page))

    const productRows = uzumProducts.map(p => ({
      shop_id:                shopId,
      marketplace_product_id: String(p.productId),
      title:                  p.name,
      sku:                    p.sku || String(p.productId),
      category:               p.categoryName,
      selling_price:          p.price,
      cost_price:             p.purchasePrice,
      stock_quantity:         p.stock,
    }))

    // Replace all products for this shop with fresh data from Uzum
    await supabase.from('products').delete().eq('shop_id', shopId)
    if (productRows.length > 0) {
      const { error: prodErr } = await supabase.from('products').insert(productRows)
      if (prodErr) throw new Error(`Mahsulotlarni saqlashda xato: ${prodErr.message}`)
    }

    // ── Sync orders (last 90 days) ────────────────────────────────────────────
    const since = new Date()
    since.setDate(since.getDate() - 90)

    const uzumOrders = await fetchAllPages(page =>
      fetchUzumOrders(token, page, 100, since.toISOString().slice(0, 10))
    )

    // Only insert orders not already stored
    const { data: existing } = await supabase
      .from('orders')
      .select('order_id_external')
      .eq('shop_id', shopId)

    const existingIds = new Set((existing ?? []).map(o => o.order_id_external))

    const newOrderRows = uzumOrders
      .filter(o => !existingIds.has(o.orderId))
      .map(o => ({
        shop_id:           shopId,
        order_id_external: o.orderId,
        marketplace:       'uzum' as const,
        status:            (STATUS_MAP[o.status] ?? 'pending') as 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'returned',
        revenue:           o.totalPrice,
        items_count:       o.items?.length ?? 1,
        ordered_at:        o.createdAt,
      }))

    if (newOrderRows.length > 0) {
      const { error: ordErr } = await supabase.from('orders').insert(newOrderRows)
      if (ordErr) throw new Error(`Buyurtmalarni saqlashda xato: ${ordErr.message}`)
    }

    // ── Update last sync timestamp ────────────────────────────────────────────
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
