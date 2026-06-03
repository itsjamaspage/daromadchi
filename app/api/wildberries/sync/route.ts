import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

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

  const token  = decrypt(shop.api_key_encrypted)
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

  // ─── Stocks (Marketplace API v1) — update selling_price + stock_quantity ───
  try {
    const stocksRes = await fetch(
      'https://marketplace-api.wildberries.ru/api/v3/stocks/0?limit=1000&offset=0',
      { headers: bearerHeaders(token) },
    )
    if (stocksRes.ok) {
      const stocksData = await stocksRes.json()
      const stocks: any[] = stocksData?.stocks ?? stocksData ?? []
      // Map nmId → stock quantity
      const stockMap = new Map<string, number>()
      for (const s of stocks) {
        if (s.nmId) stockMap.set(String(s.nmId), (stockMap.get(String(s.nmId)) ?? 0) + (s.amount ?? 0))
      }
      // Update stock_quantity for each product
      for (const [nmId, qty] of stockMap) {
        await supabase
          .from('products')
          .update({ stock_quantity: qty, updated_at: new Date().toISOString() })
          .eq('shop_id', shopId)
          .eq('marketplace_product_id', nmId)
      }
    }
  } catch { /* stocks sync is best-effort */ }

  // ─── Orders (Statistics API) ────────────────────────────────────────────────
  // WB statistics API: each row is a single item. Group by gNumber to form parent orders.
  // Note: Statistics API does NOT use Bearer prefix
  try {
    const { data: shopRow } = await supabase
      .from('shops')
      .select('last_synced_at')
      .eq('id', shopId)
      .single()
    const sinceDt = shopRow?.last_synced_at
      ? new Date(shopRow.last_synced_at)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d })()
    const df = sinceDt.toISOString().split('T')[0]

    const res = await fetch(
      `${WB_STATS}/api/v1/supplier/orders?dateFrom=${df}&flag=0`,
      { headers: statsHeaders(token) },
    )
    if (res.ok) {
      const rawLines: any[] = await res.json()
      if (Array.isArray(rawLines) && rawLines.length > 0) {
        // Group by gNumber (parent order) — each line = one item
        const grouped = new Map<string, any[]>()
        for (const line of rawLines) {
          const key = line.gNumber ?? line.srid ?? String(line.odid ?? Math.random())
          if (!grouped.has(key)) grouped.set(key, [])
          grouped.get(key)!.push(line)
        }

        const orderRows = []
        for (const [gNumber, lines] of grouped) {
          const first = lines[0]
          const totalRevenue = lines.reduce((s, l) => s + (l.finishedPrice ?? l.priceWithDisc ?? 0), 0)
          orderRows.push({
            shop_id:           shopId,
            order_id_external: gNumber,
            marketplace:       'wildberries' as const,
            status:            (first.isCancel ? 'cancelled' : 'delivered') as 'cancelled' | 'delivered',
            revenue:           totalRevenue,
            marketplace_fee:   0,
            delivery_cost:     0,
            items_count:       lines.length,
            ordered_at:        first.date ?? new Date().toISOString(),
          })
        }

        const { error } = await supabase
          .from('orders')
          .upsert(orderRows, { onConflict: 'shop_id,order_id_external' })
        if (error) errors.push(error.message)
        else ordersUpserted = orderRows.length

        // ── Order items (best-effort) ─────────────────────────────────────────
        try {
          const { data: dbProducts } = await supabase
            .from('products')
            .select('id, marketplace_product_id')
            .eq('shop_id', shopId)
          const pidMap = new Map<string, string>()
          for (const p of dbProducts ?? []) {
            if (p.marketplace_product_id) pidMap.set(String(p.marketplace_product_id), p.id as string)
          }

          const gNumbers = [...grouped.keys()]
          const { data: dbOrders } = await supabase
            .from('orders')
            .select('id, order_id_external')
            .eq('shop_id', shopId)
            .in('order_id_external', gNumbers)
          const orderIdMap = new Map<string, string>()
          for (const o of dbOrders ?? []) {
            orderIdMap.set(o.order_id_external as string, o.id as string)
          }

          const itemRows: { order_id: string; product_id: string | null; quantity: number; price_per_unit: number }[] = []
          for (const [gNumber, lines] of grouped) {
            const dbOrderId = orderIdMap.get(gNumber)
            if (!dbOrderId) continue
            for (const line of lines) {
              itemRows.push({
                order_id:       dbOrderId,
                product_id:     line.nmId ? (pidMap.get(String(line.nmId)) ?? null) : null,
                quantity:       1,
                price_per_unit: line.finishedPrice ?? line.priceWithDisc ?? 0,
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
        } catch { /* best-effort */ }
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

// GET /api/wildberries/sync — lightweight token test, no data written
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'wildberries')
    .maybeSingle()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  // Test with seller-info (common-api) — no IP whitelist required for some accounts
  try {
    const res = await fetch('https://common-api.wildberries.ru/api/v1/seller-info', {
      headers: { 'Authorization': token }
    })
    if (res.ok) {
      const info = await res.json()
      return NextResponse.json({
        ok: true,
        message: `Ulandi! Sotuvchi: ${info.supplierName || info.name || 'Wildberries'}`,
      })
    }
    if (res.status === 403) {
      return NextResponse.json({
        ok: false,
        error: 'IP-whitelist xatosi (403). Token faqat muayyan IP-dan foydalanish uchun sozlangan. Wildberries kabinetida IP cheklovini olib tashlang yoki yangi token yarating.',
      })
    }
    return NextResponse.json({ ok: false, error: `WB API xatosi: HTTP ${res.status}` })
  } catch {
    return NextResponse.json({ ok: false, error: 'WB API bilan bog\'lanishda xato' })
  }
}
