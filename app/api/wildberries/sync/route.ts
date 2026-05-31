import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Correct base URLs per WB API docs (migrated from suppliers-api Jan 2025)
const WB_CONTENT = 'https://content-api.wildberries.ru'
const WB_STATS   = 'https://statistics-api.wildberries.ru'

// Content & Ads APIs require "Bearer" prefix; Statistics API does NOT
function bearerHeaders(token: string) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}
function statsHeaders(token: string) {
  return { 'Authorization': token }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', user.id)
    .eq('marketplace', 'wildberries')
    .maybeSingle()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'No Wildberries API token saved' }, { status: 400 })
  }

  const token  = shop.api_key_encrypted
  const shopId = shop.id
  let productsUpserted = 0
  let ordersUpserted   = 0
  const errors: string[] = []

  // ─── Products (Content API v2) ──────────────────────────────────────────────
  try {
    let cursor: Record<string, unknown> = { limit: 100 }
    const allCards: unknown[] = []

    // Paginate until WB returns fewer cards than the limit
    for (let page = 0; page < 20; page++) {
      const res = await fetch(`${WB_CONTENT}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: bearerHeaders(token),
        body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }),
      })
      if (!res.ok) {
        errors.push(`Products API ${res.status}: ${await res.text()}`)
        break
      }
      const json = await res.json()
      const cards: any[] = json.data?.cards ?? json.cards ?? []
      allCards.push(...cards)
      const nextCursor = json.data?.cursor ?? json.cursor
      if (!nextCursor?.updatedAt || cards.length < 100) break
      cursor = { limit: 100, updatedAt: nextCursor.updatedAt, nmID: nextCursor.nmID }
    }

    if (allCards.length > 0) {
      const rows = (allCards as any[]).map(c => ({
        shop_id:                shopId,
        sku:                    c.vendorCode ?? null,
        title:                  c.title ?? 'Wildberries product',
        marketplace_product_id: String(c.nmID ?? ''),
        category:               c.subjectName ?? null,
        cost_price:             null,
        selling_price:          null,
        stock_quantity:         0,
        updated_at:             new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('products')
        .upsert(rows, { onConflict: 'shop_id,marketplace_product_id' })
      if (error) errors.push(error.message)
      else productsUpserted = rows.length
    }
  } catch (e) {
    errors.push(`Products sync failed: ${e}`)
  }

  // ─── Orders (Statistics API) ────────────────────────────────────────────────
  // Note: Statistics API does NOT use Bearer prefix
  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - 30)
    const df = dateFrom.toISOString().split('T')[0]

    const res = await fetch(
      `${WB_STATS}/api/v1/supplier/orders?dateFrom=${df}&flag=0`,
      { headers: statsHeaders(token) },
    )
    if (res.ok) {
      const orders: any[] = await res.json()
      if (Array.isArray(orders) && orders.length > 0) {
        const rows = orders.map(o => ({
          shop_id:           shopId,
          order_id_external: o.srid ?? o.gNumber ?? String(o.odid ?? ''),
          marketplace:       'wildberries' as const,
          status:            o.isCancel ? 'cancelled' : 'delivered',
          revenue:           o.finishedPrice ?? o.priceWithDisc ?? 0,
          marketplace_fee:   0,
          delivery_cost:     0,
          items_count:       1,
          ordered_at:        o.date ?? new Date().toISOString(),
        }))

        const { error } = await supabase
          .from('orders')
          .upsert(rows, { onConflict: 'shop_id,order_id_external' })
        if (error) errors.push(error.message)
        else ordersUpserted = rows.length
      }
    } else {
      errors.push(`Orders API ${res.status}: ${await res.text()}`)
    }
  } catch (e) {
    errors.push(`Orders sync failed: ${e}`)
  }

  // ─── Update last_synced_at ───────────────────────────────────────────────────
  await supabase.from('shops').update({ last_synced_at: new Date().toISOString() }).eq('id', shopId)

  return NextResponse.json({
    ok: errors.length === 0,
    productsUpserted,
    ordersUpserted,
    errors: errors.length > 0 ? errors : undefined,
  })
}
