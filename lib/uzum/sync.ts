import { createClient } from '@/lib/supabase/server'
import {
  fetchAllPages,
  fetchUzumOrders,
  fetchUzumProducts,
  UzumApiError,
} from './client'

const STATUS_MAP: Record<string, string> = {
  PROCESSING: 'processing',
  SHIPPED:    'shipped',
  DELIVERED:  'delivered',
  CANCELLED:  'cancelled',
}

export interface SyncResult {
  ok: boolean
  ordersUpserted: number
  productsUpserted: number
  error?: string
}

export async function syncFromUzum(token: string): Promise<SyncResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, ordersUpserted: 0, productsUpserted: 0, error: 'Autentifikatsiya talab qilinadi' }

  try {
    // ── Sync products ────────────────────────────────────────────────────────
    const uzumProducts = await fetchAllPages(page =>
      fetchUzumProducts(token, page)
    )

    const productRows = uzumProducts.map(p => ({
      user_id:  user.id,
      name:     p.name,
      sku:      p.sku,
      category: p.categoryName,
      price:    p.price,
      cost:     p.purchasePrice,
      stock:    p.stock,
    }))

    const { error: prodErr } = await supabase
      .from('products')
      .upsert(productRows, { onConflict: 'user_id,sku', ignoreDuplicates: false })

    if (prodErr) throw new Error(`Mahsulotlarni saqlashda xato: ${prodErr.message}`)

    // ── Build sku→id map for order linking ──────────────────────────────────
    const { data: savedProducts } = await supabase
      .from('products')
      .select('id, sku')
      .eq('user_id', user.id)

    const skuToId = Object.fromEntries((savedProducts ?? []).map(p => [p.sku, p.id]))

    // ── Sync orders (last 90 days to keep it bounded) ────────────────────────
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const sinceStr = since.toISOString().slice(0, 10)

    const uzumOrders = await fetchAllPages(page =>
      fetchUzumOrders(token, page, 100, sinceStr)
    )

    const orderRows = uzumOrders.map(o => {
      const firstItem = o.items?.[0]
      return {
        user_id:      user.id,
        order_ref:    o.orderNumber,
        customer:     o.customerName,
        product_name: firstItem?.productName ?? 'Noma\'lum',
        product_id:   firstItem ? (skuToId[firstItem.productId] ?? null) : null,
        amount:       o.totalPrice,
        status:       STATUS_MAP[o.status] ?? 'processing',
        ordered_at:   o.createdAt.slice(0, 10),
      }
    })

    const { error: ordErr } = await supabase
      .from('orders')
      .upsert(orderRows, { onConflict: 'user_id,order_ref', ignoreDuplicates: false })

    if (ordErr) throw new Error(`Buyurtmalarni saqlashda xato: ${ordErr.message}`)

    // ── Save last sync time ──────────────────────────────────────────────────
    await supabase
      .from('profiles')
      .update({ last_synced_at: new Date().toISOString() } as any)
      .eq('id', user.id)

    return {
      ok: true,
      ordersUpserted:   orderRows.length,
      productsUpserted: productRows.length,
    }
  } catch (err) {
    const msg = err instanceof UzumApiError
      ? `Uzum API: ${err.status} — ${err.message}`
      : err instanceof Error ? err.message : 'Noma\'lum xato'
    return { ok: false, ordersUpserted: 0, productsUpserted: 0, error: msg }
  }
}
