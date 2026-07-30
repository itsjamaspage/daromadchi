import { eq, and, inArray } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, syncDays } from '@/lib/db'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

const WB_CONTENT     = 'https://content-api.wildberries.ru'
const WB_STATS       = 'https://statistics-api.wildberries.ru'
const WB_MARKETPLACE = 'https://marketplace-api.wildberries.ru'

// Persisted per-shop rate-limit cooldown. WB's global limiter uses a
// per-seller UUID; every 429/461 seems to RESET the cooldown window if
// you keep hitting them (seller reported being locked out 17h straight
// while our cron re-fired every 15 min). Stored on shops.throttled_until
// so a deploy (which wipes any in-memory state) doesn't reset it, and
// the seller can see + manually reset it from the UI.
const WB_THROTTLE_COOLDOWN_MS = 60 * 60 * 1000 // 1h

async function readThrottleUntil(shopId: string): Promise<Date | null> {
  const [row] = await db.select({ t: shops.throttled_until })
    .from(shops).where(eq(shops.id, shopId)).limit(1)
  return row?.t ?? null
}
async function writeThrottleUntil(shopId: string, until: Date | null) {
  await db.update(shops).set({ throttled_until: until }).where(eq(shops.id, shopId))
}
export async function clearWbThrottle(shopId: string) {
  await writeThrottleUntil(shopId, null)
}
// Read-only helper for the settings card's "Throttled by WB until X" chip.
// Returns null when the stored cooldown has already passed.
export async function getWbThrottledUntil(shopId: string): Promise<number | null> {
  const until = await readThrottleUntil(shopId)
  if (until == null || until.getTime() <= Date.now()) return null
  return until.getTime()
}

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
  // Orders actually INSERTED this run (WB's report only carries finished
  // orders — delivered/cancelled — so there are no fulfilment alerts here).
  ordersInserted?: number
  errors?: string[]
}

export async function syncFromWildberries(
  _unused: unknown,
  shopId: string,
  token: string,
  fromDateOverride?: Date,
): Promise<WbSyncResult> {
  // Short-circuit: if WB rate-limited us in the last hour, skip the
  // whole sync. Each 429 seems to extend WB's cooldown, so hitting them
  // during the block makes it last longer, not shorter.
  const throttledUntil = await getWbThrottledUntil(shopId)
  if (throttledUntil) {
    const minsLeft = Math.max(1, Math.ceil((throttledUntil - Date.now()) / 60_000))
    return {
      ok: false,
      productsUpserted: 0,
      ordersUpserted: 0,
      errors: [`WB throttled — skipping sync for ~${minsLeft} more minutes to let their limiter reset.`],
    }
  }

  let productsUpserted = 0
  let ordersUpserted   = 0
  let ordersInserted   = 0
  let revenueTotal     = 0
  let ordersOk         = false
  let stockOk          = false
  const errors: string[] = []
  // barcode → nmId, needed for FBS stock lookups (v3 stocks API is barcode-keyed)
  const barcodeToNm = new Map<string, string>()

  // Wrapped in a helper for uniform 429/461 handling across every WB call
  // in this function. Any 429 or 461 flips the shop into cooldown state
  // and returns `null` so the caller can short-circuit its own request.
  async function wbFetch(url: string, init?: RequestInit): Promise<Response | null> {
    const res = await marketplaceFetch(url, init)
    if (res.status === 429 || res.status === 461) {
      const until = new Date(Date.now() + WB_THROTTLE_COOLDOWN_MS)
      await writeThrottleUntil(shopId, until)
      console.warn(`[WB sync] rate-limited (${res.status}) on ${url} — cooldown until ${until.toISOString()}`)
      errors.push(`WB rate-limit (${res.status}); pausing WB sync for ~1 hour.`)
      return null
    }
    return res
  }

  // ─── Products (Content API v2) ──────────────────────────────────────────────
  try {
    let cursor: Record<string, unknown> = { limit: 100 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCards: any[] = []

    for (let page = 0; page < 20; page++) {
      const res = await wbFetch(`${WB_CONTENT}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: bearerHeaders(token),
        body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }),
      })
      if (!res) break // rate-limited; wbFetch already recorded the cooldown + error
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
        // Default 'fbo' — WB's dominant model. Overwritten per-product below
        // if the FBS warehouses endpoint reports the SKU (in which case the
        // seller is shipping it themselves).
        fulfillment_type:       'fbo' as const,
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

      // Zombie cleanup: when a seller deletes a card on WB, the product row
      // used to sit in our DB forever with the last-known stock number,
      // corrupting the Ostatki total. Now: any DB row whose nmID isn't in
      // the fresh card list from WB gets deleted here. Gated on:
      //   (a) products fetch completed without an errors.push — otherwise
      //       a rate-limited / partial page could nuke real products.
      //   (b) allCards.length > 0 — an empty response could also be a
      //       transient auth issue, not "seller has zero listings".
      // order_items.product_id has ON DELETE SET NULL so historical orders
      // survive the delete (they just lose the product link).
      const productsFetchClean = errors.every(e => !e.startsWith('Products API'))
      if (productsFetchClean && allCards.length > 0) {
        const freshIds = new Set(rows.map(r => String(r.marketplace_product_id)))
        const zombieIds = existingProds
          .filter(p => !freshIds.has(String(p.marketplace_product_id)))
          .map(p => p.id)
        if (zombieIds.length > 0) {
          await db.delete(products).where(and(
            eq(products.shop_id, shopId),
            inArray(products.id, zombieIds),
          ))
        }
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
    // Which endpoint reported this nmId: 'fbo' (WB warehouse) or 'fbs'
    // (seller's own warehouse). Wins over the 'fbo' default set at product
    // upsert when FBS reports it.
    const stockSource = new Map<string, 'fbo' | 'fbs'>()
    // fboOk stays false until the replacement endpoint (post-2026-07-20
    // deprecation) is wired in. Kept as a variable so the success gate below
    // reads clearly and the hook-point is obvious to whoever restores FBO.
    const fboOk = false
    let fbsOk = false

    // Track why each stock source didn't answer so a fresh shop / missing
    // scope / rate limit / no-barcodes shape all look distinct in logs.
    let fbsSkippedReason: string | null = null
    // WB retired /api/v1/supplier/stocks on 2026-07-20 (PLUG-404-20260720,
    // release note id=494). No verified replacement path yet — the
    // seller-analytics-api warehouse_remains report is the leading guess but
    // hasn't been confirmed against live docs. Skipping FBO entirely
    // (option "c") so the sync toast reads clean and FBS carries the load
    // until we ship the real replacement. Same shape as fbsSkippedReason.
    const fboSkippedReason: string | null = 'endpoint_deprecated_20260720'

    if (barcodeToNm.size === 0) {
      // No barcodes on record yet (fresh shop, or cards sync hasn't populated
      // barcodes). FBS stock endpoint requires SKUs — skip it, but say so.
      fbsSkippedReason = 'no_barcodes'
    } else {
      try {
        const whRes = await wbFetch(`${WB_MARKETPLACE}/api/v3/warehouses`, { headers: bearerHeaders(token) })
        if (!whRes) throw new Error('rate-limited')
        if (whRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const whs: any[] = await whRes.json() ?? []
          const allBarcodes = [...barcodeToNm.keys()]
          outer: for (const wh of whs) {
            if (!wh?.id) continue
            for (let i = 0; i < allBarcodes.length; i += 1000) {
              const res = await wbFetch(`${WB_MARKETPLACE}/api/v3/stocks/${wh.id}`, {
                method: 'POST',
                headers: bearerHeaders(token),
                body: JSON.stringify({ skus: allBarcodes.slice(i, i + 1000) }),
              })
              if (!res) break outer // rate-limited — abort remaining warehouses
              if (!res.ok) continue
              const json = await res.json()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const stocks: any[] = json?.stocks ?? []
              for (const s of stocks) {
                const nm = barcodeToNm.get(String(s.sku))
                if (nm) {
                  stockMap.set(nm, (stockMap.get(nm) ?? 0) + (s.amount ?? 0))
                  // FBS overrides FBO for the fulfillment tag — if a SKU is
                  // in a seller warehouse, that's what the seller is shipping.
                  stockSource.set(nm, 'fbs')
                }
              }
            }
          }
          fbsOk = true
        } else {
          let body = ''
          try { body = await whRes.text() } catch { /* ignore */ }
          const detail = `FBS warehouses: HTTP ${whRes.status} ${whRes.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
          console.error(`[WB sync] ${detail}`)
          errors.push(detail)
        }
      } catch (e) {
        const detail = `FBS warehouses: ${e instanceof Error ? e.message : String(e)}`
        console.error(`[WB sync] FBS warehouses fetch threw:`, e)
        errors.push(detail)
      }
    }

    // Success = at least one source answered OR both were legitimately
    // skipped (FBO deprecated + FBS has no barcodes yet). Only a live source
    // silently failing counts as a real "stock=false".
    const bothSkipped = fboSkippedReason !== null && fbsSkippedReason !== null
    const stockAnswered = fboOk || fbsOk || bothSkipped
    if (stockAnswered) {
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
        const nm = String(p.marketplace_product_id)
        const reported = stockMap.get(nm)
        const qty = reported ?? (bothOk ? 0 : p.stock_quantity)
        const source = stockSource.get(nm)
        const patch: Record<string, unknown> = { updated_at: new Date() }
        if (qty !== p.stock_quantity) patch.stock_quantity = qty
        if (source) patch.fulfillment_type = source
        if (Object.keys(patch).length > 1) {
          await db.update(products).set(patch).where(eq(products.id, p.id))
        }
      }
      stockOk = true
    }
  } catch { /* stocks sync is best-effort */ }

  const sridToGNumber = new Map<string, string>()

  // ─── Orders (Statistics API) ────────────────────────────────────────────────
  try {
    const [shopRow] = await db.select({ last_synced_at: shops.last_synced_at })
      .from(shops).where(eq(shops.id, shopId))

    const sinceDt = fromDateOverride
      ?? (shopRow?.last_synced_at
        ? new Date(shopRow.last_synced_at)
        : (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d })())
    const df = sinceDt.toISOString().split('T')[0]

    // Fetch sales data (has forPay = net amount after WB commission)
    const salesFeeByGNumber = new Map<string, { fee: number; delivery: number }>()
    try {
      const salesRes = await wbFetch(
        `${WB_STATS}/api/v1/supplier/sales?dateFrom=${df}&flag=0`,
        { headers: statsHeaders(token) },
      )
      if (salesRes && salesRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salesLines: any[] = await salesRes.json()
        if (Array.isArray(salesLines)) {
          for (const line of salesLines) {
            const gn = line.gNumber
            if (!gn || line.IsStorno) continue
            const salePrice = line.finishedPrice ?? line.priceWithDisc ?? 0
            const forPay = line.forPay ?? 0
            const fee = Math.max(salePrice - forPay, 0)
            const prev = salesFeeByGNumber.get(gn) ?? { fee: 0, delivery: 0 }
            prev.fee += fee
            salesFeeByGNumber.set(gn, prev)
          }
        }
      }
    } catch { /* sales data is best-effort */ }

    const res = await wbFetch(
      `${WB_STATS}/api/v1/supplier/orders?dateFrom=${df}&flag=0`,
      { headers: statsHeaders(token) },
    )
    if (!res) {
      // Rate-limited. wbFetch already recorded the cooldown; return
      // whatever we've got so far.
      return { ok: false, productsUpserted, ordersUpserted, ordersInserted, errors }
    }
    if (!res.ok) {
      // Surface the real reason so a shop with a broken token / rate limit /
      // permissions issue doesn't look identical to a shop with 0 orders.
      // Body must be read exactly once — the else branch below used to also
      // call res.text() which triggered "Body has already been read".
      let body = ''
      try { body = await res.text() } catch { /* ignore */ }
      console.error(`[WB sync] orders fetch failed: HTTP ${res.status} ${res.statusText}\n${body.slice(0, 500)}`)
      errors.push(`Orders API ${res.status}: ${(body || res.statusText).slice(0, 200)}`)
    }
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawLines: any[] = await res.json()
      if (!Array.isArray(rawLines)) {
        console.error(`[WB sync] orders endpoint returned a non-array payload: ${JSON.stringify(rawLines).slice(0, 200)}`)
      } else {
        // Empty response is a real, valid state — a fresh shop or a
        // `dateFrom` window with no activity legitimately returns []. Mark
        // orders synced here so we don't misreport it as "orders=false".
        ordersOk = true
      }
      if (Array.isArray(rawLines) && rawLines.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const grouped = new Map<string, any[]>()
        for (const line of rawLines) {
          const key = line.gNumber ?? line.srid ?? String(line.odid ?? Math.random())
          if (!grouped.has(key)) grouped.set(key, [])
          grouped.get(key)!.push(line)
          if (line.srid) sridToGNumber.set(String(line.srid), key)
        }

        const orderRowsToInsert = []
        for (const [gNumber, lines] of grouped) {
          const first = lines[0]
          const totalRevenue = lines.reduce((s: number, l: { finishedPrice?: number; priceWithDisc?: number }) => s + (l.finishedPrice ?? l.priceWithDisc ?? 0), 0)
          revenueTotal += totalRevenue
          const salesData = salesFeeByGNumber.get(gNumber)
          orderRowsToInsert.push({
            shop_id:           shopId,
            order_id_external: gNumber,
            marketplace:       'wildberries' as const,
            status:            (first.isCancel ? 'cancelled' : 'delivered') as 'cancelled' | 'delivered',
            revenue:           String(totalRevenue),
            marketplace_fee:   salesData ? String(salesData.fee) : null,
            delivery_cost:     null,
            items_count:       lines.length,
            ordered_at:        new Date(first.date ?? new Date().toISOString()),
            fulfillment_type:  'fbo' as const,
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
            status: r.status, revenue: r.revenue, marketplace_fee: r.marketplace_fee,
            items_count: r.items_count,
          }).where(eq(orders.id, existingOrderMap.get(r.order_id_external)!))
        }
        ordersUpserted = orderRowsToInsert.length
        ordersInserted = toInsert.length
        ordersOk = true

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
    }
    // Note: the !res.ok branch above already logs + pushes the error and
    // consumes the body. Do NOT add an else here that calls res.text() again.
  } catch (e) {
    errors.push(`Orders sync failed: ${e}`)
  }

  // ─── Finance report (reportDetailByPeriod) ────────────────────────────────
  // Fetches per-sale financial data to populate real commission and delivery
  // costs on WB orders, replacing the null placeholders.
  try {
    const reportSince = fromDateOverride
      ?? (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d })()
    const reportFrom = reportSince.toISOString().split('T')[0]
    const reportTo = new Date().toISOString().split('T')[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allReportEntries: any[] = []
    let lastRrdId = 0
    for (let page = 0; page < 20; page++) {
      const url = `${WB_STATS}/api/v1/supplier/reportDetailByPeriod?dateFrom=${reportFrom}&dateTo=${reportTo}` +
        (lastRrdId > 0 ? `&rrdid=${lastRrdId}` : '')
      const reportRes = await wbFetch(url, { headers: statsHeaders(token) })
      if (!reportRes) break // rate-limited
      if (!reportRes.ok) break
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: any[] = await reportRes.json()
      if (!Array.isArray(entries) || entries.length === 0) break
      allReportEntries.push(...entries)
      lastRrdId = entries[entries.length - 1].rrd_id ?? 0
      if (entries.length < 100000) break
    }

    if (allReportEntries.length > 0) {
      const financeByOrder = new Map<string, {
        commission: number; delivery: number
        penalty: number; storageFee: number; additionalPayment: number
      }>()
      // Orders with return entries in the finance report
      const returnedGNumbers = new Set<string>()
      for (const entry of allReportEntries) {
        const srid = entry.srid ? String(entry.srid) : ''
        const gNumber = sridToGNumber.get(srid) ?? srid
        if (!gNumber) continue
        const existing = financeByOrder.get(gNumber) ?? {
          commission: 0, delivery: 0, penalty: 0, storageFee: 0, additionalPayment: 0,
        }
        existing.commission += Math.abs(Number(entry.ppvz_sales_commission ?? 0))
        existing.delivery += Math.abs(Number(entry.delivery_rub ?? 0))
        existing.penalty += Math.abs(Number(entry.penalty ?? 0))
        existing.storageFee += Math.abs(Number(entry.storage_fee ?? 0))
        existing.additionalPayment += Math.abs(Number(entry.additional_payment ?? 0))
        financeByOrder.set(gNumber, existing)

        // WB marks returns with doc_type_name 'Возврат' or negative retail_amount
        const isReturn = entry.doc_type_name === 'Возврат'
          || Number(entry.return_amount ?? 0) > 0
          || Number(entry.retail_amount ?? 0) < 0
        if (isReturn) returnedGNumbers.add(gNumber)
      }

      if (financeByOrder.size > 0) {
        const gNumbers = [...financeByOrder.keys()].slice(0, 5000)
        const dbOrdersForFinance = await db.select({
          id: orders.id,
          order_id_external: orders.order_id_external,
          status: orders.status,
        }).from(orders).where(and(
          eq(orders.shop_id, shopId),
          inArray(orders.order_id_external, gNumbers),
        ))

        for (const dbOrder of dbOrdersForFinance) {
          const finance = financeByOrder.get(dbOrder.order_id_external as string)
          const isReturned = returnedGNumbers.has(dbOrder.order_id_external as string)
          const updates: Record<string, unknown> = {}
          if (finance && (finance.commission > 0 || finance.delivery > 0 || finance.penalty > 0 || finance.storageFee > 0 || finance.additionalPayment > 0)) {
            updates.marketplace_fee = String(finance.commission)
            updates.delivery_cost = String(finance.delivery)
            updates.penalty = String(finance.penalty)
            updates.storage_fee = String(finance.storageFee)
            updates.additional_payment = String(finance.additionalPayment)
          }
          if (isReturned && dbOrder.status !== 'returned') {
            updates.status = 'returned'
          }
          if (Object.keys(updates).length > 0) {
            await db.update(orders).set(updates).where(eq(orders.id, dbOrder.id))
          }
        }
      }
    }
  } catch { /* finance report is best-effort */ }

  // ─── Sync metadata ────────────────────────────────────────────────────────
  // Only advance last_synced_at when critical data (orders + stock) succeeded.
  // Finance/ads are secondary and can be backfilled later.
  const criticalOk = ordersOk && stockOk
  if (!criticalOk && errors.length === 0) {
    errors.push(`WB sync partial: orders=${ordersOk}, stock=${stockOk}`)
  }
  const today = new Date().toISOString().slice(0, 10)
  const promises: Promise<unknown>[] = [
    db.insert(syncDays).values({
      shop_id: shopId,
      sync_date: today,
      status: errors.length === 0 ? 'success' : criticalOk ? 'error' : 'degraded',
      error_message: errors.length > 0 ? errors.join('; ').slice(0, 500) : null,
      products_count: productsUpserted,
      revenue: String(revenueTotal),
      synced_at: new Date(),
    }).onConflictDoUpdate({
      target: [syncDays.shop_id, syncDays.sync_date],
      set: {
        status: errors.length === 0 ? 'success' : criticalOk ? 'error' : 'degraded',
        error_message: errors.length > 0 ? errors.join('; ').slice(0, 500) : null,
        products_count: productsUpserted,
        revenue: String(revenueTotal),
        synced_at: new Date(),
      },
    }),
  ]
  if (criticalOk) {
    promises.push(db.update(shops).set({ last_synced_at: new Date() }).where(eq(shops.id, shopId)))
  }
  await Promise.all(promises)

  return {
    ok: errors.length === 0,
    productsUpserted,
    ordersUpserted,
    ordersInserted,
    errors: errors.length > 0 ? errors : undefined,
  }
}
