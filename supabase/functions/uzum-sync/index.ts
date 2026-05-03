// Supabase Edge Function — scheduled Uzum sync
// Deploy: supabase functions deploy uzum-sync
// Schedule (supabase/config.toml):
//   [functions.uzum-sync]
//   schedule = "0 */6 * * *"   # every 6 hours

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api'

const STATUS_MAP: Record<string, string> = {
  PROCESSING: 'processing',
  SHIPPED:    'shipped',
  DELIVERED:  'delivered',
  CANCELLED:  'cancelled',
}

async function uzumFetch(path: string, token: string) {
  const res = await fetch(`${UZUM_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Uzum API ${res.status}: ${path}`)
  return res.json()
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all users who have a token configured
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, uzum_api_token')
    .not('uzum_api_token', 'is', null)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const results = []

  for (const profile of profiles ?? []) {
    const token = profile.uzum_api_token as string
    const userId = profile.id as string

    try {
      // ── Sync products ──────────────────────────────────────────────────────
      let page = 0, totalProducts = 0
      while (true) {
        const res = await uzumFetch(`/v1/products?page=${page}&size=100`, token)
        const items = res.data ?? []
        if (!items.length) break

        await supabase.from('products').upsert(
          items.map((p: any) => ({
            user_id:  userId,
            name:     p.name,
            sku:      p.sku,
            category: p.categoryName,
            price:    p.price,
            cost:     p.purchasePrice,
            stock:    p.stock,
          })),
          { onConflict: 'user_id,sku' }
        )

        totalProducts += items.length
        if (items.length < 100) break
        page++
      }

      // ── Sync orders (last 90 days) ─────────────────────────────────────────
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const sinceStr = since.toISOString().slice(0, 10)

      page = 0
      let totalOrders = 0
      while (true) {
        const res = await uzumFetch(
          `/v1/orders?page=${page}&size=100&dateFrom=${sinceStr}`,
          token
        )
        const items = res.data ?? []
        if (!items.length) break

        await supabase.from('orders').upsert(
          items.map((o: any) => ({
            user_id:      userId,
            order_ref:    o.orderNumber,
            customer:     o.customerName,
            product_name: o.items?.[0]?.productName ?? 'Noma\'lum',
            amount:       o.totalPrice,
            status:       STATUS_MAP[o.status] ?? 'processing',
            ordered_at:   o.createdAt.slice(0, 10),
          })),
          { onConflict: 'user_id,order_ref' }
        )

        totalOrders += items.length
        if (items.length < 100) break
        page++
      }

      await supabase
        .from('profiles')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', userId)

      results.push({ userId, ok: true, totalProducts, totalOrders })
    } catch (err) {
      results.push({ userId, ok: false, error: String(err) })
    }
  }

  return new Response(JSON.stringify({ synced: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
