import { eq, and, inArray, count } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, syncDays, adCampaigns } from '@/lib/db'
import {
  fetchAllPages,
  fetchUzumOrders,
  fetchUzumShops,
  fetchUzumShopProducts,
  fetchUzumAdCampaigns,
  UzumApiError,
  type UzumFbsOrder,
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
  // Observability: how many raw orders each source returned, and whether the
  // order endpoints actually succeeded. When ordersDegraded is true, the order
  // fetch failed and last_synced_at was intentionally NOT advanced so the same
  // window is retried on the next run (see the metadata update below).
  fbsCount?: number
  fboCount?: number
  ordersDegraded?: boolean
  error?: string
  details?: string
}

export async function syncFromUzum(shopId: string, token: string, fromDateOverride?: Date): Promise<SyncResult> {
  const warnings: string[] = []

  try {
    // ── Products: resolve shop(s), then pull product/SKU data ─────────────────
    // Uzum seller API is shop-scoped: GET /v1/shops → shopId, then
    // GET /v1/product/shop/{shopId} returns products with their SKUs (price,
    // purchasePrice = cost, quantityActive = stock, quantitySold).
    const uzumShops = await fetchUzumShops(token)
    if (uzumShops.length === 0) {
      throw new Error("Uzum do'kon topilmadi (/v1/shops bo'sh qaytdi)")
    }

    const productRows: {
      shop_id: string; marketplace_product_id: string; title: string; sku: string
      category: string | null; selling_price: number | null; cost_price: number | null
      stock_quantity: number
    }[] = []

    // Product sync is best-effort: shops with 0 active listings return 403.
    // We still want to fetch orders for such shops, so catch and continue.
    try {
      for (const uShop of uzumShops) {
        const size = 100
        for (let page = 0; page < 100; page++) {
          const res = await fetchUzumShopProducts(token, uShop.id, page, size)
          const list = res.productList ?? []
          for (const card of list) {
            for (const sku of card.skuList ?? []) {
              productRows.push({
                shop_id: shopId,
                marketplace_product_id: String(sku.skuId),
                title: sku.skuTitle || sku.productTitle || card.title || 'Mahsulot',
                sku: sku.sellerItemCode || sku.article || String(sku.skuId),
                category: card.category ?? null,
                selling_price: sku.price ?? null,
                cost_price: sku.purchasePrice || null,
                stock_quantity: (sku.quantityActive ?? 0) + (sku.quantityFbs ?? 0),
              })
            }
          }
          const total = res.totalProductsAmount ?? 0
          if (list.length < size || (page + 1) * size >= total) break
        }
      }

      if (productRows.length > 0) {
        const existingProds = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
          .from(products).where(eq(products.shop_id, shopId))
        const existingMap = new Map(existingProds.map(p =>
          [String(p.marketplace_product_id), String(p.id)]))
        const toIns = productRows.filter(r => !existingMap.has(String(r.marketplace_product_id)))
        const toUpd = productRows.filter(r => existingMap.has(String(r.marketplace_product_id)))
          .map(r => ({ ...r, id: existingMap.get(String(r.marketplace_product_id))! }))
        if (toIns.length > 0) {
          await db.insert(products).values(toIns.map(r => ({
            shop_id: r.shop_id,
            marketplace_product_id: r.marketplace_product_id,
            title: r.title,
            sku: r.sku,
            category: r.category,
            selling_price: r.selling_price != null ? String(r.selling_price) : null,
            cost_price: r.cost_price != null ? String(r.cost_price) : null,
            stock_quantity: r.stock_quantity,
          })))
        }
        if (toUpd.length > 0) {
          for (const r of toUpd) {
            await db.update(products).set({
              title: r.title,
              sku: r.sku,
              category: r.category,
              selling_price: r.selling_price != null ? String(r.selling_price) : null,
              stock_quantity: r.stock_quantity,
              marketplace_product_id: r.marketplace_product_id,
            }).where(eq(products.id, r.id))
          }
        }
      }
    } catch (prodSyncErr) {
      // Non-fatal: 403 means shop has no active listings. Continue to orders.
      warnings.push(`Products: ${prodSyncErr instanceof UzumApiError ? `${prodSyncErr.status} ${prodSyncErr.body?.slice(0, 150) ?? ''}` : String(prodSyncErr)}`)
    }

    // ── Orders (incremental: since last sync, or caller-supplied override) ──────
    const [shopRows, productCountRows] = await Promise.all([
      db.select({ last_synced_at: shops.last_synced_at }).from(shops).where(eq(shops.id, shopId)).limit(1),
      db.select({ total: count() }).from(products).where(eq(products.shop_id, shopId)),
    ])
    const shopRow = shopRows[0] ?? null
    const existingProductCount = productCountRows[0]?.total ?? 0

    // Incremental: only fetch orders since last sync to avoid overwriting existing
    // order statuses (which would remove previously-counted revenue from the chart).
    const since = fromDateOverride
      ?? (shopRow?.last_synced_at
        ? new Date(shopRow.last_synced_at)
        : (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d })())

    // Orders — fetch both FBS (/v2/fbs/orders) and FBO (/v2/fbo/orders).
    // Many Uzum sellers use FBO (Uzum warehouse), so FBS alone returns 0.
    const uzumShopIds = uzumShops.map(s => s.id)
    const fromDateMs = since.getTime()

    // Track whether each order source actually succeeded. A single source
    // failing is normal (a seller may only use FBS or only FBO), but if BOTH
    // fail we must not advance last_synced_at — otherwise the orders in this
    // window are skipped forever.
    let fbsOk = true
    let fboOk = true
    const [fbsOrders, fboOrders] = await Promise.all([
      fetchAllPages(page => fetchUzumOrders(token, uzumShopIds, page, 100, fromDateMs))
        .catch(e => { fbsOk = false; warnings.push(`FBS: ${e instanceof UzumApiError ? `${e.status} ${e.body?.slice(0, 150) ?? ''}` : String(e)}`); return [] as UzumFbsOrder[] }),
      fetchAllPages(page => fetchUzumOrders(token, uzumShopIds, page, 100, fromDateMs, undefined, 'fbo'))
        .catch(e => { fboOk = false; warnings.push(`FBO: ${e instanceof UzumApiError ? `${e.status} ${e.body?.slice(0, 150) ?? ''}` : String(e)}`); return [] as UzumFbsOrder[] }),
    ])
    const ordersDegraded = !fbsOk && !fboOk
    const uzumOrders: UzumFbsOrder[] = [
      ...fbsOrders,
      // Deduplicate by id in case FBO endpoint overlaps with FBS
      ...fboOrders.filter(o => !fbsOrders.some(f => String(f.id) === String(o.id))),
    ]

    const orderRows = uzumOrders.map(o => {
      // Support both new (id/dateCreated/price/orderItems) and legacy field names
      const extId = String(o.id ?? o.orderId)
      const orderedAt = o.dateCreated ?? o.createdAt ?? new Date().toISOString()
      const revenue = o.price ?? o.totalPrice ?? 0
      const allItems = o.orderItems ?? o.items ?? []
      return {
        shop_id: shopId,
        order_id_external: extId,
        marketplace: 'uzum' as const,
        status: (STATUS_MAP[o.status] ?? 'pending') as
          | 'pending'
          | 'confirmed'
          | 'delivered'
          | 'cancelled'
          | 'returned',
        revenue,
        items_count: allItems.length || 1,
        ordered_at: orderedAt,
      }
    })

    // Upsert: inserts new orders AND updates status of existing ones
    if (orderRows.length > 0) {
      const extIds = orderRows.map(r => r.order_id_external)
      const existingOrds = await db.select({ id: orders.id, order_id_external: orders.order_id_external })
        .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds)))
      const existingOrdMap = new Map(existingOrds.map(o => [o.order_id_external, o.id]))

      const toInsOrd = orderRows.filter(r => !existingOrdMap.has(r.order_id_external))
      const toUpdOrd = orderRows.filter(r => existingOrdMap.has(r.order_id_external))

      if (toInsOrd.length > 0) {
        for (let i = 0; i < toInsOrd.length; i += 500) {
          await db.insert(orders).values(toInsOrd.slice(i, i + 500).map(r => ({
            shop_id: r.shop_id,
            order_id_external: r.order_id_external,
            marketplace: r.marketplace,
            status: r.status,
            revenue: String(r.revenue),
            items_count: r.items_count,
            ordered_at: new Date(r.ordered_at),
          })))
        }
      }
      for (const r of toUpdOrd) {
        await db.update(orders).set({
          status: r.status,
          revenue: String(r.revenue),
          items_count: r.items_count,
          ordered_at: new Date(r.ordered_at),
        }).where(eq(orders.id, existingOrdMap.get(r.order_id_external)!))
      }
    }

    // ── Derive products from order items if product sync returned nothing ────────
    // Happens when the Uzum product API 403s or returns 0 — orders are present
    // but productRows is still empty, leaving the products table blank.
    if (productRows.length === 0 && uzumOrders.length > 0) {
      try {
        const seenMap = new Map<string, typeof productRows[0]>()
        for (const o of uzumOrders) {
          for (const it of (o.orderItems ?? o.items ?? [])) {
            const mpid = String(it.skuId)
            if (!seenMap.has(mpid)) {
              seenMap.set(mpid, {
                shop_id: shopId,
                marketplace_product_id: mpid,
                title: it.productTitle ?? `SKU ${it.skuId}`,
                sku: mpid,
                category: null,
                selling_price: it.price ?? null,
                cost_price: null,
                stock_quantity: 0,
              })
            }
          }
        }
        if (seenMap.size > 0) {
          const derived = [...seenMap.values()]
          const existingProds = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
            .from(products).where(eq(products.shop_id, shopId))
          const existingMap = new Map(
            existingProds.map(p => [String(p.marketplace_product_id), String(p.id)]),
          )
          const toIns = derived.filter(r => !existingMap.has(r.marketplace_product_id))
          const toUpd = derived
            .filter(r => existingMap.has(r.marketplace_product_id))
            .map(r => ({ ...r, id: existingMap.get(r.marketplace_product_id)! }))
          if (toIns.length > 0) {
            await db.insert(products).values(toIns.map(r => ({
              shop_id: r.shop_id,
              marketplace_product_id: r.marketplace_product_id,
              title: r.title,
              sku: r.sku,
              category: r.category,
              selling_price: r.selling_price != null ? String(r.selling_price) : null,
              cost_price: r.cost_price != null ? String(r.cost_price) : null,
              stock_quantity: r.stock_quantity,
            })))
          }
          if (toUpd.length > 0) {
            for (const r of toUpd) {
              await db.update(products).set({
                title: r.title,
                sku: r.sku,
                category: r.category,
                selling_price: r.selling_price != null ? String(r.selling_price) : null,
                stock_quantity: r.stock_quantity,
                marketplace_product_id: r.marketplace_product_id,
              }).where(eq(products.id, r.id))
            }
          }
          productRows.push(...derived)
        }
      } catch { /* best-effort */ }
    }

    const newOrderRows = orderRows

    // ── Product extraction from API when table is empty and no current batch ──
    // Runs when incremental sync has no new orders AND products table is empty.
    // Fetches recent orders from API ONLY for product/SKU info — does NOT upsert
    // those orders to the DB so existing order statuses are never overwritten.
    if (productRows.length === 0 && existingProductCount === 0) {
      try {
        const extractMs = Date.now() - 90 * 24 * 60 * 60 * 1000
        const [fbsEx, fboEx] = await Promise.all([
          fetchAllPages(p => fetchUzumOrders(token, uzumShopIds, p, 100, extractMs))
            .catch(() => [] as UzumFbsOrder[]),
          fetchAllPages(p => fetchUzumOrders(token, uzumShopIds, p, 100, extractMs, undefined, 'fbo'))
            .catch(() => [] as UzumFbsOrder[]),
        ])
        const extractOrders: UzumFbsOrder[] = [
          ...fbsEx,
          ...fboEx.filter(o => !fbsEx.some(f => String(f.id) === String(o.id))),
        ]
        if (extractOrders.length > 0) {
          const seenMap = new Map<string, typeof productRows[0]>()
          for (const o of extractOrders) {
            for (const it of (o.orderItems ?? o.items ?? [])) {
              const mpid = String(it.skuId)
              if (!seenMap.has(mpid)) {
                seenMap.set(mpid, {
                  shop_id: shopId, marketplace_product_id: mpid,
                  title: it.productTitle ?? `SKU ${it.skuId}`,
                  sku: mpid, category: null,
                  selling_price: it.price ?? null, cost_price: null, stock_quantity: 0,
                })
              }
            }
          }
          if (seenMap.size > 0) {
            const derived = [...seenMap.values()]
            const ep = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
              .from(products).where(eq(products.shop_id, shopId))
            const em = new Map(ep.map(p => [String(p.marketplace_product_id), String(p.id)]))
            const toIns = derived.filter(r => !em.has(r.marketplace_product_id))
            const toUpd = derived.filter(r => em.has(r.marketplace_product_id)).map(r => ({ ...r, id: em.get(r.marketplace_product_id)! }))
            if (toIns.length > 0) {
              await db.insert(products).values(toIns.map(r => ({
                shop_id: r.shop_id,
                marketplace_product_id: r.marketplace_product_id,
                title: r.title,
                sku: r.sku,
                category: r.category,
                selling_price: r.selling_price != null ? String(r.selling_price) : null,
                cost_price: r.cost_price != null ? String(r.cost_price) : null,
                stock_quantity: r.stock_quantity,
              })))
            }
            if (toUpd.length > 0) {
              for (const r of toUpd) {
                await db.update(products).set({
                  title: r.title,
                  sku: r.sku,
                  category: r.category,
                  selling_price: r.selling_price != null ? String(r.selling_price) : null,
                  stock_quantity: r.stock_quantity,
                  marketplace_product_id: r.marketplace_product_id,
                }).where(eq(products.id, r.id))
              }
            }
            productRows.push(...derived)
            // Re-create order_items for these orders already in DB with correct product_ids
            const extIds = extractOrders.map(o => String(o.id ?? o.orderId))
            const [dbOrds, dbProds] = await Promise.all([
              db.select({ id: orders.id, order_id_external: orders.order_id_external })
                .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds))),
              db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
                .from(products).where(eq(products.shop_id, shopId)),
            ])
            const oMap = new Map<string, string>(); for (const o of dbOrds) oMap.set(o.order_id_external as string, o.id as string)
            const pMap = new Map<string, string>(); for (const p of dbProds) if (p.marketplace_product_id) pMap.set(String(p.marketplace_product_id), p.id as string)
            const itmRows: { order_id: string; product_id: string | null; quantity: number; price_per_unit: number }[] = []
            for (const o of extractOrders) {
              const dbOid = oMap.get(String(o.id ?? o.orderId))
              if (!dbOid) continue
              for (const it of (o.orderItems ?? o.items ?? [])) {
                itmRows.push({ order_id: dbOid, product_id: pMap.get(String(it.skuId)) ?? null, quantity: it.quantity, price_per_unit: it.price })
              }
            }
            if (itmRows.length > 0) {
              const dbOids = [...new Set(itmRows.map(r => r.order_id))]
              await db.delete(orderItems).where(inArray(orderItems.order_id, dbOids))
              for (let i = 0; i < itmRows.length; i += 500) {
                await db.insert(orderItems).values(itmRows.slice(i, i + 500).map(r => ({
                  order_id: r.order_id,
                  product_id: r.product_id,
                  quantity: r.quantity,
                  price_per_unit: String(r.price_per_unit),
                })))
              }
            }
          }
        }
      } catch { /* best-effort: product extraction is non-fatal */ }
    }

    // ── Order items (best-effort) ─────────────────────────────────────────────
    // Build a map: marketplace_product_id → products.id for fast lookup
    try {
      const dbProducts = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id })
        .from(products).where(eq(products.shop_id, shopId))
      const pidMap = new Map<string, string>()
      for (const p of dbProducts) {
        if (p.marketplace_product_id) pidMap.set(String(p.marketplace_product_id), p.id as string)
      }

      // Map order_id_external → orders.id
      const extIds = uzumOrders.map(o => String(o.id ?? o.orderId))
      const dbOrders = await db.select({ id: orders.id, order_id_external: orders.order_id_external })
        .from(orders).where(and(eq(orders.shop_id, shopId), inArray(orders.order_id_external, extIds)))
      const orderIdMap = new Map<string, string>()
      for (const o of dbOrders) {
        orderIdMap.set(o.order_id_external as string, o.id as string)
      }

      const itemRows: {
        order_id: string; product_id: string | null;
        quantity: number; price_per_unit: number
      }[] = []
      for (const o of uzumOrders) {
        const extId = String(o.id ?? o.orderId)
        const dbOrderId = orderIdMap.get(extId)
        if (!dbOrderId) continue
        for (const it of (o.orderItems ?? o.items ?? [])) {
          itemRows.push({
            order_id:       dbOrderId,
            product_id:     pidMap.get(String(it.skuId)) ?? null,
            quantity:       it.quantity,
            price_per_unit: it.price,
          })
        }
      }

      // Delete old items for these orders then re-insert (simpler than upsert without unique key)
      if (itemRows.length > 0) {
        const dbOrderIds = [...new Set(itemRows.map(r => r.order_id))]
        await db.delete(orderItems).where(inArray(orderItems.order_id, dbOrderIds))
        for (let i = 0; i < itemRows.length; i += 500) {
          await db.insert(orderItems).values(itemRows.slice(i, i + 500).map(r => ({
            order_id: r.order_id,
            product_id: r.product_id,
            quantity: r.quantity,
            price_per_unit: String(r.price_per_unit),
          })))
        }
      }
    } catch { /* order items sync is best-effort */ }

    // ── Ad campaigns (best-effort — gracefully skipped if endpoint 404s) ──────
    let campaignsUpserted = 0
    try {
      const uzumCampaigns = await fetchAllPages(page => fetchUzumAdCampaigns(token, page))

      if (uzumCampaigns.length > 0) {
        const campaignRows = uzumCampaigns.map(c => ({
          shop_id: shopId,
          name: c.name,
          type: (c.type === 'CPC' ? 'cpc' : 'cpo') as 'cpc' | 'cpo',
          status: (AD_STATUS_MAP[c.status] ?? 'stopped') as 'active' | 'paused' | 'stopped',
          product_title: c.productName ?? '',
          spend: String(c.spentBudget ?? 0),
          impressions: c.impressions ?? 0,
          clicks: c.clicks ?? 0,
          ctr: String(c.clicks && c.impressions ? (c.clicks / c.impressions) * 100 : 0),
          orders: c.orders ?? 0,
          revenue: String(c.revenue ?? 0),
          drr: String(c.revenue && c.spentBudget ? (c.spentBudget / c.revenue) * 100 : 0),
          start_date: c.startDate,
        }))

        await db.delete(adCampaigns).where(eq(adCampaigns.shop_id, shopId))
        for (let i = 0; i < campaignRows.length; i += 500) {
          await db.insert(adCampaigns).values(campaignRows.slice(i, i + 500))
        }

        campaignsUpserted = campaignRows.length
      }
    } catch {
      // Ad sync is best-effort — don't fail the whole sync
    }

    // ── Update sync metadata ──────────────────────────────────────────────────
    // Advance last_synced_at ONLY when the order fetch didn't fully fail.
    // Advancing it after a failed fetch would permanently skip this window's
    // orders on the next incremental run.
    const today = new Date().toISOString().slice(0, 10)
    const dayStatus = ordersDegraded ? 'degraded' : 'success'
    const dayError  = ordersDegraded && warnings.length
      ? `Buyurtmalarni yuklab bo'lmadi: ${warnings.join(' | ')}`.slice(0, 500)
      : null
    const metaWrites: Promise<unknown>[] = [
      db.insert(syncDays).values({
        shop_id: shopId,
        sync_date: today,
        status: dayStatus,
        products_count: productRows.length,
        revenue: String(newOrderRows.reduce((s, o) => s + (o.revenue ?? 0), 0)),
        error_message: dayError,
        synced_at: new Date(),
      }).onConflictDoUpdate({
        target: [syncDays.shop_id, syncDays.sync_date],
        set: {
          status: dayStatus,
          products_count: productRows.length,
          revenue: String(newOrderRows.reduce((s, o) => s + (o.revenue ?? 0), 0)),
          error_message: dayError,
          synced_at: new Date(),
        },
      }),
    ]
    if (!ordersDegraded) {
      metaWrites.push(db.update(shops).set({ last_synced_at: new Date() }).where(eq(shops.id, shopId)))
    }
    await Promise.all(metaWrites)

    return {
      ok: true,
      ordersUpserted: newOrderRows.length,
      productsUpserted: productRows.length,
      campaignsUpserted,
      fbsCount: fbsOrders.length,
      fboCount: fboOrders.length,
      ordersDegraded,
      details: warnings.length ? warnings.join(' | ') : undefined,
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
      await db.insert(syncDays).values({
        shop_id: shopId,
        sync_date: today,
        status: 'error',
        error_message: msg.slice(0, 500),
        synced_at: new Date(),
      }).onConflictDoUpdate({
        target: [syncDays.shop_id, syncDays.sync_date],
        set: {
          status: 'error',
          error_message: msg.slice(0, 500),
          synced_at: new Date(),
        },
      })
    } catch { /* ignore secondary failure */ }

    return { ok: false, ordersUpserted: 0, productsUpserted: 0, campaignsUpserted: 0, error: msg }
  }
}
