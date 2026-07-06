import type { SupabaseClient } from '@supabase/supabase-js'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

// Correct base URLs per WB API docs (migrated from suppliers-api Jan 2025)
const WB_CONTENT = 'https://content-api.wildberries.ru'
const WB_STATS   = 'https://statistics-api.wildberries.ru'

// Content API requires the "Bearer" prefix; the Statistics API does NOT.
function bearerHeaders(token: string) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}
function statsHeaders(token: string) {
  return { 'Authorization': token }
}

export interface WbSyncResult {
  ok: boolean
  productsUpserted: number
  ordersUpserted: number
  errors?: string[]
}

/**
 * Sync products, stock and orders from Wildberries for one shop.
 *
 * Takes a Supabase client so it can run both from the user-scoped API route
 * (server client) and from the scheduled cron (admin client). All queries are
 * scoped by shopId, so either client works.
 */
export async function syncFromWildberries(
  supabase: SupabaseClient,
  shopId: string,
  token: string,
  fromDateOverride?: Date,
): Promise<WbSyncResult> {
  let productsUpserted = 0
  let ordersUpserted   = 0
  let revenueTotal     = 0
  const errors: string[] = []

  // ─── Products (Content API v2) ──────────────────────────────────────────────
  try {
    let cursor: Record<string, unknown> = { limit: 100 }
    const allCards: unknown[] = []

    for (let page = 0; page < 20; page++) {
      const res = await marketplaceFetch(`${WB_CONTENT}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: bearerHeaders(token),
        body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }),
      })
      if (!res.ok) {
        errors.push(`Products API ${res.status}: ${await res.text()}`)
        break
      }
      const json = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cards: any[] = json.data?.cards ?? json.cards ?? []
      allCards.push(...cards)
      const nextCursor = json.data?.cursor ?? json.cursor
      if (!nextCursor?.updatedAt || cards.length < 100) break
      cursor = { limit: 100, updatedAt: nextCursor.updatedAt, nmID: nextCursor.nmID }
    }

    if (allCards.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const { data: existingProds } = await supabase
        .from('products').select('id, marketplace_product_id').eq('shop_id', shopId)
      const existingMap = new Map((existingProds ?? []).map((p: { id: string; marketplace_product_id: string }) =>
        [String(p.marketplace_product_id), String(p.id)]))
      const toIns = rows.filter((r: { marketplace_product_id: string }) => !existingMap.has(String(r.marketplace_product_id)))
      const toUpd = rows.filter((r: { marketplace_product_id: string }) => existingMap.has(String(r.marketplace_product_id)))
        .map((r: { marketplace_product_id: string }) => ({ ...r, id: existingMap.get(String(r.marketplace_product_id))! }))
      if (toIns.length > 0) { const { error: e } = await supabase.from('products').insert(toIns); if (e) errors.push(e.message) }
      if (toUpd.length > 0) { const { error: e } = await supabase.from('products').upsert(toUpd); if (e) errors.push(e.message) }
      if (!errors.length) productsUpserted = rows.length
    }
  } catch (e) {
    errors.push(`Products sync failed: ${e}`)
  }

  // ─── Stocks (Marketplace API v1) — update stock_quantity ───────────────────
  try {
    const stocksRes = await marketplaceFetch(
      'https://marketplace-api.wildberries.ru/api/v3/stocks/0?limit=1000&offset=0',
      { headers: bearerHeaders(token) },
    )
    if (stocksRes.ok) {
      const stocksData = await stocksRes.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stocks: any[] = stocksData?.stocks ?? stocksData ?? []
      const stockMap = new Map<string, number>()
      for (const s of stocks) {
        if (s.nmId) stockMap.set(String(s.nmId), (stockMap.get(String(s.nmId)) ?? 0) + (s.amount ?? 0))
      }
      if (stockMap.size > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, marketplace_product_id')
          .eq('shop_id', shopId)
          .in('marketplace_product_id', [...stockMap.keys()])
        const now = new Date().toISOString()
        const updateRows = (prods ?? [])
          .filter((p: { marketplace_product_id: string }) => stockMap.has(String(p.marketplace_product_id)))
          .map((p: { id: string; marketplace_product_id: string }) => ({
            id: p.id,
            stock_quantity: stockMap.get(String(p.marketplace_product_id))!,
            updated_at: now,
          }))
        if (updateRows.length > 0) {
          const { error: e } = await supabase.from('products').upsert(updateRows)
          if (e) errors.push(e.message)
        }
      }
    }
  } catch { /* stocks sync is best-effort */ }

  // ─── Orders (Statistics API) ────────────────────────────────────────────────
  // Each row is a single item; group by gNumber to form parent orders.
  try {
    const { data: shopRow } = await supabase
      .from('shops')
      .select('last_synced_at')
      .eq('id', shopId)
      .single()
    const sinceDt = fromDateOverride
      ?? (shopRow?.last_synced_at
        ? new Date(shopRow.last_synced_at)
        : (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d })())
    const df = sinceDt.toISOString().split('T')[0]

    const res = await marketplaceFetch(
      `${WB_STATS}/api/v1/supplier/orders?dateFrom=${df}&flag=0`,
      { headers: statsHeaders(token) },
    )
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawLines: any[] = await res.json()
      if (Array.isArray(rawLines) && rawLines.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          revenueTotal += totalRevenue
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

  // ─── Sync metadata ────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  await Promise.all([
    supabase.from('shops').update({ last_synced_at: new Date().toISOString() }).eq('id', shopId),
    supabase.from('sync_days').upsert(
      {
        shop_id: shopId,
        sync_date: today,
        status: errors.length === 0 ? 'success' : 'error',
        products_count: productsUpserted,
        revenue: revenueTotal,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,sync_date' },
    ),
  ])

  return {
    ok: errors.length === 0,
    productsUpserted,
    ordersUpserted,
    errors: errors.length > 0 ? errors : undefined,
  }
}
