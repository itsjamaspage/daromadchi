import { eq, and, inArray } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, syncDays } from '@/lib/db'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

const WB_CONTENT     = 'https://content-api.wildberries.ru'
const WB_STATS       = 'https://statistics-api.wildberries.ru'
const WB_MARKETPLACE = 'https://marketplace-api.wildberries.ru'

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

export async function syncFromWildberries(
  _unused: unknown,
  shopId: string,
  token: string,
  fromDateOverride?: Date,
): Promise<WbSyncResult> {
  let productsUpserted = 0
  let ordersUpserted   = 0
  let revenueTotal     = 0
  const errors: string[] = []
  // barcode → nmId, needed for FBS stock lookups (v3 stocks API is barcode-keyed)
  const barcodeToNm = new Map<string, string>()

  // ─── Products (Content API v2) ──────────────────────────────────────────────
  try {
    let cursor: Record<string, unknown> = { limit: 100 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCards: any[] = []

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

    for (const c of allCards) {
      for (const size of c.sizes ?? []) {
        for (const barcode of size.skus ?? []) {
          if (barcode && c.nmID) barcodeToNm.set(String(barcode), String(c.nmID))
        }
      }
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
        updated_at:             new Date(),
      }))

      const existingProds = await db.select({
        id: products.id,
        marketplace_product_id: products.marketplace_product_id,
      }).from(products).where(eq(products.shop_id, shopId))

      const existingMap = new Map(existingProds.map(p => [String(p.marketplace_product_id), p.id]))
      const toIns = rows.filter(r => !existingMap.has(String(r.marketplace_product_id)))
      const toUpd = rows.filter(r => existingMap.has(String(r.marketplace_product_id)))

      if (toIns.length > 0) {
        await db.insert(products).values(toIns)
      }
      for (const r of toUpd) {
        const id = existingMap.get(String(r.marketplace_product_id))!
        await db.update(products).set({
          sku: r.sku, title: r.title, category: r.category, updated_at: r.updated_at,
        }).where(eq(products.id, id))
      }
      if (!errors.length) productsUpserted = rows.length
    }
  } catch (e) {
    errors.push(`Products sync failed: ${e}`)
  }

  // ─── Stocks ───────────────────────────────────────────────────────────────
  // WB reports stock through two separate read-only APIs:
  //  • FBO (goods stored at WB warehouses): GET statistics-api /api/v1/supplier/stocks
  //  • FBS (seller's own warehouses): GET /api/v3/warehouses, then per warehouse
  //    POST /api/v3/stocks/{warehouseId} with barcodes — POST is WB's read method
  //    here; the write variant is PUT on the same path, which the guard blocks.
  try {
    const stockMap = new Map<string, number>() // nmId → total units
    let fboOk = false
    let fbsOk = false

    try {
      const fboRes = await marketplaceFetch(
        `${WB_STATS}/api/v1/supplier/stocks?dateFrom=2019-06-20`,
        { headers: statsHeaders(token) },
      )
      if (fboRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = await fboRes.json() ?? []
        for (const r of rows) {
          if (r.nmId) stockMap.set(String(r.nmId), (stockMap.get(String(r.nmId)) ?? 0) + (r.quantity ?? 0))
        }
        fboOk = true
      }
    } catch { /* best-effort */ }

    if (barcodeToNm.size > 0) {
      try {
        const whRes = await marketplaceFetch(`${WB_MARKETPLACE}/api/v3/warehouses`, { headers: bearerHeaders(token) })
        if (whRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const whs: any[] = await whRes.json() ?? []
          const allBarcodes = [...barcodeToNm.keys()]
          for (const wh of whs) {
            if (!wh?.id) continue
            for (let i = 0; i < allBarcodes.length; i += 1000) {
              const res = await marketplaceFetch(`${WB_MARKETPLACE}/api/v3/stocks/${wh.id}`, {
                method: 'POST',
                headers: bearerHeaders(token),
                body: JSON.stringify({ skus: allBarcodes.slice(i, i + 1000) }),
              })
              if (!res.ok) continue
              const json = await res.json()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const stocks: any[] = json?.stocks ?? []
              for (const s of stocks) {
                const nm = barcodeToNm.get(String(s.sku))
                if (nm) stockMap.set(nm, (stockMap.get(nm) ?? 0) + (s.amount ?? 0))
              }
            }
          }
          fbsOk = true
        }
      } catch { /* best-effort */ }
    }

    if (fboOk || fbsOk) {
      const prods = await db.select({
        id: products.id,
        marketplace_product_id: products.marketplace_product_id,
        stock_quantity: products.stock_quantity,
      }).from(products).where(eq(products.shop_id, shopId))

      // With both sources answering, absence means genuinely 0 left; with only
      // one source, zeroing would wipe stock held at the other, so update only
      // products the responding source reported.
      const bothOk = fboOk && fbsOk
      for (const p of prods) {
        const reported = stockMap.get(String(p.marketplace_product_id))
        const qty = reported ?? (bothOk ? 0 : p.stock_quantity)
        if (qty !== p.stock_quantity) {
          await db.update(products).set({ stock_quantity: qty, updated_at: new Date() }).where(eq(products.id, p.id))
        }
      }
    }
  } catch { /* stocks sync is best-effort */ }

  // ─── Orders (Statistics API) ────────────────────────────────────────────────
  try {
    const [shopRow] = await db.select({ last_synced_at: shops.last_synced_at })
      .from(shops).where(eq(shops.id, shopId))

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

        const orderRowsToInsert = []
        for (const [gNumber, lines] of grouped) {
          const first = lines[0]
          const totalRevenue = lines.reduce((s: number, l: { finishedPrice?: number; priceWithDisc?: number }) => s + (l.finishedPrice ?? l.priceWithDisc ?? 0), 0)
          revenueTotal += totalRevenue
          orderRowsToInsert.push({
            shop_id:           shopId,
            order_id_external: gNumber,
            marketplace:       'wildberries' as const,
            status:            (first.isCancel ? 'cancelled' : 'delivered') as 'cancelled' | 'delivered',
            revenue:           String(totalRevenue),
            marketplace_fee:   '0',
            delivery_cost:     '0',
            items_count:       lines.length,
            ordered_at:        new Date(first.date ?? new Date().toISOString()),
          })
        }

        // Check existing orders to decide insert vs update
        const extIds = orderRowsToInsert.map(r => r.order_id_external)
        const existingOrders = await db.select({ id: orders.id, order_id_external: orders.order_id_external })
          .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds)))
        const existingOrderMap = new Map(existingOrders.map(o => [o.order_id_external, o.id]))

        const toInsert = orderRowsToInsert.filter(r => !existingOrderMap.has(r.order_id_external))
        const toUpdate = orderRowsToInsert.filter(r => existingOrderMap.has(r.order_id_external))

        if (toInsert.length > 0) {
          for (let i = 0; i < toInsert.length; i += 500) {
            await db.insert(orders).values(toInsert.slice(i, i + 500))
          }
        }
        for (const r of toUpdate) {
          await db.update(orders).set({
            status: r.status, revenue: r.revenue, items_count: r.items_count,
          }).where(eq(orders.id, existingOrderMap.get(r.order_id_external)!))
        }
        ordersUpserted = orderRowsToInsert.length

        // ── Order items (best-effort) ─────────────────────────────────────────
        try {
          const dbProducts = await db.select({
            id: products.id,
            marketplace_product_id: products.marketplace_product_id,
          }).from(products).where(eq(products.shop_id, shopId))
          const pidMap = new Map<string, string>()
          for (const p of dbProducts) {
            if (p.marketplace_product_id) pidMap.set(String(p.marketplace_product_id), p.id)
          }

          const gNumbers = [...grouped.keys()]
          const dbOrders = await db.select({ id: orders.id, order_id_external: orders.order_id_external })
            .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, gNumbers)))
          const orderIdMap = new Map<string, string>()
          for (const o of dbOrders) {
            if (o.order_id_external) orderIdMap.set(o.order_id_external, o.id)
          }

          const itemRows: { order_id: string; product_id: string | null; quantity: number; price_per_unit: string }[] = []
          for (const [gNumber, lines] of grouped) {
            const dbOrderId = orderIdMap.get(gNumber)
            if (!dbOrderId) continue
            for (const line of lines) {
              itemRows.push({
                order_id:       dbOrderId,
                product_id:     line.nmId ? (pidMap.get(String(line.nmId)) ?? null) : null,
                quantity:       1,
                price_per_unit: String(line.finishedPrice ?? line.priceWithDisc ?? 0),
              })
            }
          }

          if (itemRows.length > 0) {
            const dbOrderIds = [...new Set(itemRows.map(r => r.order_id))]
            await db.delete(orderItems).where(inArray(orderItems.order_id, dbOrderIds))
            for (let i = 0; i < itemRows.length; i += 500) {
              await db.insert(orderItems).values(itemRows.slice(i, i + 500))
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
    db.update(shops).set({ last_synced_at: new Date() }).where(eq(shops.id, shopId)),
    db.insert(syncDays).values({
      shop_id: shopId,
      sync_date: today,
      status: errors.length === 0 ? 'success' : 'error',
      products_count: productsUpserted,
      revenue: String(revenueTotal),
      synced_at: new Date(),
    }).onConflictDoUpdate({
      target: [syncDays.shop_id, syncDays.sync_date],
      set: {
        status: errors.length === 0 ? 'success' : 'error',
        products_count: productsUpserted,
        revenue: String(revenueTotal),
        synced_at: new Date(),
      },
    }),
  ])

  return {
    ok: errors.length === 0,
    productsUpserted,
    ordersUpserted,
    errors: errors.length > 0 ? errors : undefined,
  }
}
