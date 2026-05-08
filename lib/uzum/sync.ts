import { createClient } from '@/lib/supabase/server'
import {
  fetchAllPages,
  fetchUzumOrders,
  fetchUzumProducts,
  fetchUzumAdCampaigns,
  UzumApiError,
} from './client'

const STATUS_MAP: Record<string, string> = {
  PROCESSING: 'pending',
  SHIPPED: 'confirmed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
}

const AD_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  COMPLETED: 'stopped',
}

export interface SyncResult {
  ok: boolean
  ordersUpserted: number
  productsUpserted: number
  campaignsUpserted: number
  error?: string
  details?: string
}

export async function syncFromUzum(shopId: string, token: string): Promise<SyncResult> {
  const supabase = await createClient()

  try {
    // ── Products (full refresh — Uzum doesn't paginate deltas) ────────────────
    const uzumProducts = await fetchAllPages(page => fetchUzumProducts(token, page))

    const productRows = uzumProducts.map(p => ({
      shop_id: shopId,
      marketplace_product_id: String(p.productId),
      title: p.name,
      sku: p.sku || String(p.productId),
      category: p.categoryName,
      selling_price: p.price,
      cost_price: p.purchasePrice || null,
      stock_quantity: p.stock ?? 0,
    }))

    // Upsert — safer than delete+insert; existing cost_price edits are preserved
    if (productRows.length > 0) {
      const { error: prodErr } = await supabase
        .from('products')
        .upsert(productRows, { onConflict: 'shop_id,marketplace_product_id', ignoreDuplicates: false })
      if (prodErr) throw new Error(`Mahsulotlarni saqlashda xato: ${prodErr.message}`)
    }

    // ── Orders (incremental: since last sync, fallback 90 days) ───────────────
    const { data: shopRow } = await supabase
      .from('shops')
      .select('last_synced_at')
      .eq('id', shopId)
      .single()

    const since = shopRow?.last_synced_at
      ? new Date(shopRow.last_synced_at)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d })()

    const fromDate = since.toISOString().slice(0, 10)

    const uzumOrders = await fetchAllPages(page =>
      fetchUzumOrders(token, page, 100, fromDate),
    )

    const { data: existing } = await supabase
      .from('orders')
      .select('order_id_external')
      .eq('shop_id', shopId)

    const existingIds = new Set((existing ?? []).map(o => o.order_id_external))

    const newOrderRows = uzumOrders
      .filter(o => !existingIds.has(o.orderId))
      .map(o => ({
        shop_id: shopId,
        order_id_external: o.orderId,
        marketplace: 'uzum' as const,
        status: (STATUS_MAP[o.status] ?? 'pending') as
          | 'pending'
          | 'confirmed'
          | 'delivered'
          | 'cancelled'
          | 'returned',
        revenue: o.totalPrice,
        items_count: o.items?.length ?? 1,
        ordered_at: o.createdAt,
      }))

    if (newOrderRows.length > 0) {
      const { error: ordErr } = await supabase.from('orders').insert(newOrderRows)
      if (ordErr) throw new Error(`Buyurtmalarni saqlashda xato: ${ordErr.message}`)
    }

    // ── Ad campaigns (best-effort — gracefully skipped if endpoint 404s) ──────
    let campaignsUpserted = 0
    try {
      const uzumCampaigns = await fetchAllPages(page => fetchUzumAdCampaigns(token, page))

      if (uzumCampaigns.length > 0) {
        const campaignRows = uzumCampaigns.map(c => ({
          shop_id: shopId,
          marketplace_campaign_id: c.campaignId,
          name: c.name,
          type: c.type === 'CPC' ? 'cpc' : 'cpo',
          status: AD_STATUS_MAP[c.status] ?? 'stopped',
          product_title: c.productName ?? '',
          spend: c.spentBudget ?? 0,
          impressions: c.impressions ?? 0,
          clicks: c.clicks ?? 0,
          ctr: c.clicks && c.impressions ? (c.clicks / c.impressions) * 100 : 0,
          orders: c.orders ?? 0,
          revenue: c.revenue ?? 0,
          drr: c.revenue && c.spentBudget ? (c.spentBudget / c.revenue) * 100 : 0,
          start_date: c.startDate,
        }))

        const { error: adErr } = await supabase
          .from('ad_campaigns')
          .upsert(campaignRows, { onConflict: 'shop_id,marketplace_campaign_id', ignoreDuplicates: false })

        if (!adErr) campaignsUpserted = campaignRows.length
      }
    } catch {
      // Ad sync is best-effort — don't fail the whole sync
    }

    // ── Update last_synced_at ─────────────────────────────────────────────────
    await supabase
      .from('shops')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', shopId)

    // Update sync_days record for today
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
      err instanceof UzumApiError
        ? `Uzum API xatosi ${err.status}: ${err.message}${err.body ? `\n${err.body.slice(0, 200)}` : ''}`
        : err instanceof Error
          ? err.message
          : "Noma'lum xato"

    // Record sync failure
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
    } catch { /* ignore secondary failure */ }

    return { ok: false, ordersUpserted: 0, productsUpserted: 0, campaignsUpserted: 0, error: msg }
  }
}
