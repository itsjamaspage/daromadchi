import { eq, and, inArray, count, sql } from 'drizzle-orm'
import { db, shops, products, orders, orderItems, syncDays, adCampaigns } from '@/lib/db'
import { clearShopData } from '@/lib/db/clear-shop-data'
import {
  fetchAllPages,
  fetchUzumOrders,
  fetchUzumShops,
  fetchUzumShopProducts,
  fetchUzumAdCampaigns,
  fetchUzumFbsStatusEnum,
  fetchUzumInvoices,
  discoverUzumFinancePaths,
  fetchUzumFinanceData,
  UzumApiError,
  type UzumFbsOrder,
  type UzumFbsOrderItem,
} from './client'

const STATUS_MAP: Record<string, string> = {
  // Not-yet-shipped / being prepared by the seller
  CREATED: 'pending',
  NEW: 'pending',
  PENDING: 'pending',
  CONFIRMED: 'pending',
  AGREED: 'pending',
  ACCEPTED: 'pending',
  PACKED: 'pending',
  PACKAGED: 'pending',
  ASSEMBLED: 'pending',
  READY: 'pending',
  PROCESSING: 'pending',
  PACKING: 'pending',
  IN_PROGRESS: 'pending',
  PENDING_CANCELLATION: 'pending',
  // Handed to Uzum / in transit / awaiting pickup at the PVZ
  SENT: 'confirmed',
  HANDED_OVER: 'confirmed',
  TRANSFERRED: 'confirmed',
  ON_DELIVERY: 'confirmed',
  DELIVERING: 'confirmed',
  ACTIVE: 'confirmed',
  PENDING_DELIVERY: 'confirmed',
  ACCEPTED_AT_DP: 'confirmed',
  DELIVERED_TO_CUSTOMER_DELIVERY_POINT: 'confirmed',
  TO_WITHDRAW: 'confirmed',
  PARTIALLY_CANCELLED: 'confirmed',
  // Finished
  DELIVERED: 'delivered',
  COMPLETED: 'delivered',
  // Cancelled / returned
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled',
  EXPIRED: 'cancelled',
  RETURNED: 'returned',
}

// The FBS orders endpoint returns nothing without a status filter, so we query
// each status and merge. This list is the ORDER-STATUS vocabulary from Uzum's
// own OpenAPI spec (/swagger/api-docs, discovered 2026-07-20) — the earlier
// hand-tested list of 6 missed real statuses like PACKING/PENDING_DELIVERY,
// which is exactly where a fresh not-yet-shipped order lives (a real active
// order was invisible for days because of that). Names Uzum rejects for a
// given account return 400 and are recorded in debug, not treated as errors.
const FBS_STATUSES = [
  'CREATED', 'PROCESSING', 'PACKING', 'TO_WITHDRAW', 'PENDING_DELIVERY',
  'DELIVERING', 'ACCEPTED_AT_DP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT',
  'DELIVERED', 'COMPLETED', 'PENDING_CANCELLATION', 'PARTIALLY_CANCELLED',
  'CANCELED', 'RETURNED',
]

// The spec-derived enum, cached per server process so cron syncs don't
// re-download the OpenAPI document (and burn rate limit) on every run.
let statusEnumCache: { value: string[]; at: number } | null = null
const STATUS_ENUM_TTL_MS = 6 * 60 * 60 * 1000

// FBS/FBO order queries use size=50 — the exact page size /api/uzum/diagnose
// proved returns orders. Uzum answers a generic 400 "bad-request-001" for any
// parameter it dislikes, so an unproven size risks every status query failing.
const ORDERS_PAGE_SIZE = 50

// External order id: SellerOrderDto uses `id`; legacy payloads use `orderId`.
const extIdOf = (o: UzumFbsOrder): string => String(o.id ?? o.orderId ?? '')

// dateCreated may be an ISO string, an epoch number, or a numeric string —
// and the epoch may be seconds or milliseconds. An unparseable value must not
// become Invalid Date (that would abort the whole upsert), so fall back to now.
function parseOrderedAt(v: unknown): Date {
  if (typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v))) {
    const n = Number(v)
    const d = new Date(n < 1e12 ? n * 1000 : n)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (typeof v === 'string' && v) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

// Uzum's FBS list can report quantity=1 while the order-level price is an
// exact multiple of the unit price (a real 2-unit order came back as one
// item, quantity 1, price 76 000 with order price 152 000). When the order has
// a single line item and the total divides evenly, trust the ratio. When the
// item carries no usable price, fall back to the product's known selling
// price so the app can still work out the real unit count.
function effectiveQty(
  o: UzumFbsOrder,
  it: UzumFbsOrderItem,
  lineCount: number,
  fallbackUnitPrice?: number | null,
): number {
  const q = it.quantity ?? it.amount ?? 1
  const p = it.price > 0 ? it.price : (fallbackUnitPrice ?? 0)
  const total = o.price ?? o.totalPrice
  if (lineCount === 1 && p > 0 && total != null && total > p * q && total % p === 0) {
    return total / p
  }
  return q
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
  // Orders actually INSERTED this run (ordersUpserted counts every order the
  // sync touched, including unchanged re-reads — useless for "new order"
  // notifications). newOrders carries one display line per inserted order
  // that still needs fulfilling (pending/confirmed).
  ordersInserted?: number
  newOrders?: string[]
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
  // order_items rows written. 0 while ordersUpserted > 0 means the list
  // response carried no orderItems — the raw order in debug shows why.
  itemsUpserted?: number
  // Per-request outcome of every order query (e.g. fbs_CANCELED: "1" or
  // "HTTP 400 …") plus the first raw order JSON. Returned to the Settings card
  // so a failing sync is diagnosable without server logs.
  debug?: Record<string, string>
}

export async function syncFromUzum(shopId: string, token: string): Promise<SyncResult> {
  const warnings: string[] = []
  const debug: Record<string, string> = {}
  let itemsUpserted = 0
  let ordersInserted = 0
  const newOrders: string[] = []
  const commissionBySkuId = new Map<string, number>()

  try {
    // ── Products: resolve shop(s), then pull product/SKU data ─────────────────
    // Uzum seller API is shop-scoped: GET /v1/shops → shopId, then
    // GET /v1/product/shop/{shopId} returns products with their SKUs (price,
    // purchasePrice = cost, quantityActive = stock, quantitySold).
    const uzumShops = await fetchUzumShops(token)
    if (uzumShops.length === 0) {
      throw new Error("Uzum do'kon topilmadi (/v1/shops bo'sh qaytdi)")
    }

    // Detect a genuinely different seller account. Token saves no longer wipe
    // data (that left the app empty after routine token re-saves); instead the
    // sync compares the Uzum shop id against the stored one and clears only on
    // a real switch, then records the current id.
    const uzumPrimaryId = String(uzumShops[0].id)
    const [shopRow] = await db.select({ shop_id_external: shops.shop_id_external })
      .from(shops).where(eq(shops.id, shopId))
    if (shopRow && shopRow.shop_id_external && shopRow.shop_id_external !== uzumPrimaryId) {
      await clearShopData(shopId)
      warnings.push(`Uzum akkaunt o'zgardi (${shopRow.shop_id_external} → ${uzumPrimaryId}) — eski ma'lumotlar tozalandi`)
    }
    if (!shopRow?.shop_id_external || shopRow.shop_id_external !== uzumPrimaryId) {
      await db.update(shops).set({ shop_id_external: uzumPrimaryId }).where(eq(shops.id, shopId))
    }

    const productRows: {
      shop_id: string; marketplace_product_id: string; title: string; sku: string
      category: string | null; selling_price: number | null; cost_price: number | null
      stock_quantity: number; quantity_sold: number | null
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
              if (sku.commission != null && sku.commission > 0) {
                commissionBySkuId.set(String(sku.skuId), sku.commission)
              }
              productRows.push({
                shop_id: shopId,
                marketplace_product_id: String(sku.skuId),
                title: sku.skuTitle || sku.productTitle || card.title || 'Mahsulot',
                sku: sku.sellerItemCode || sku.article || String(sku.skuId),
                category: card.category ?? null,
                selling_price: sku.price ?? null,
                cost_price: sku.purchasePrice || null,
                stock_quantity: (sku.quantityActive ?? 0) + (sku.quantityFbs ?? 0),
                // Marketplace-authoritative lifetime units sold (includes FBO,
                // which we can't read at the order level). Used as the "sold"
                // figure so FBO sales are counted even without order records.
                quantity_sold: sku.quantitySold ?? null,
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
            quantity_sold: r.quantity_sold,
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
              quantity_sold: r.quantity_sold,
              marketplace_product_id: r.marketplace_product_id,
            }).where(eq(products.id, r.id))
          }
        }
      }
    } catch (prodSyncErr) {
      // Non-fatal: 403 means shop has no active listings. Continue to orders.
      warnings.push(`Products: ${prodSyncErr instanceof UzumApiError ? `${prodSyncErr.status} ${prodSyncErr.body?.slice(0, 150) ?? ''}` : String(prodSyncErr)}`)
    }

    // ── Orders ──────────────────────────────────────────────────────────────
    const [productCountRows] = await Promise.all([
      db.select({ total: count() }).from(products).where(eq(products.shop_id, shopId)),
    ])
    const existingProductCount = productCountRows[0]?.total ?? 0

    // Orders — fetch FBS (/v2/fbs/orders) and FBO (/v2/fbo/orders).
    // NOTE: we intentionally send NO date filter. Uzum's orders endpoints treat
    // dateFrom/dateTo in a way that silently returns 0 for real orders (a unit
    // mismatch — ms vs seconds — pushes the range far into the future). Confirmed
    // via /api/uzum/diagnose: with dateFrom+dateTo every status returned 0, but
    // with NO date filter fbs?status=CANCELED returned the actual order. So we
    // fetch all pages per status and upsert (upsert is idempotent, so re-reading
    // the full set every sync is safe).
    const uzumShopIds = uzumShops.map(s => s.id)

    // Track whether each order source actually succeeded. A single source
    // failing is normal (a seller may only use FBS or only FBO — e.g. FBO
    // returns "RBAC: access denied" when the API key lacks FBO scope), but if
    // BOTH fail we must not advance last_synced_at — otherwise the orders in
    // this window are skipped forever.
    let fbsOk = false
    let fboOk = false

    // Small pause between order calls so we don't burst into Uzum's rate limiter
    // (429), which previously caused the real order's status query to be skipped.
    const pause = () => new Promise(r => setTimeout(r, 350))

    // Status list: prefer the AUTHORITATIVE enum from Uzum's own OpenAPI spec
    // (/swagger/api-docs — proven readable), cached for 6h per process so the
    // half-hourly cron doesn't re-download the spec every run. Falls back to
    // the static list (itself spec-derived) when the spec is unreachable —
    // either way every real order status gets swept.
    let fbsStatuses = FBS_STATUSES
    if (statusEnumCache && Date.now() - statusEnumCache.at < STATUS_ENUM_TTL_MS) {
      fbsStatuses = statusEnumCache.value
      debug.statusSource = `cached:${fbsStatuses.length}`
    } else {
      const specEnum = await fetchUzumFbsStatusEnum(token)
      if (specEnum && specEnum.length > 0) {
        fbsStatuses = specEnum.slice(0, 20)
        statusEnumCache = { value: fbsStatuses, at: Date.now() }
        debug.statusSource = `openapi:${specEnum.length}`
      }
    }

    // FBS: query each valid status and merge. fbsOk is true if at least one
    // status query succeeded (even with 0 results), so a genuinely empty FBS
    // account isn't treated as a failure.
    const fbsById = new Map<string, UzumFbsOrder>()
    for (const st of fbsStatuses) {
      try {
        const batch = await fetchAllPages(page => fetchUzumOrders(token, uzumShopIds, page, ORDERS_PAGE_SIZE, undefined, undefined, 'fbs', st))
        fbsOk = true
        debug[`fbs_${st}`] = String(batch.length)
        for (const o of batch) fbsById.set(extIdOf(o), o)
      } catch (e) {
        // Record EVERY failure in debug — silently dropping errors is how a
        // total order-fetch failure previously looked like "0 orders, ok".
        // 400 = status name not valid for this endpoint (possible with the
        // spec-derived enum); visible in debug but not worth a warning.
        const msg = e instanceof UzumApiError ? `HTTP ${e.status} ${e.body?.slice(0, 120) ?? ''}` : String(e)
        debug[`fbs_${st}`] = msg
        if (!(e instanceof UzumApiError && e.status === 400)) {
          warnings.push(`FBS ${st}: ${msg}`)
        }
      }
      await pause()
    }

    // FBS invoices: /v1/invoice is readable on this account while a fresh
    // not-yet-shipped order is missing from every /v2/fbs/orders status. Pull
    // it as an additional order source: order-shaped records (own id + price/
    // items/status) merge into the FBS set; the first record's raw JSON is
    // surfaced in debug so the real field names are always visible.
    try {
      const invoices = await fetchUzumInvoices(token, uzumShopIds)
      debug.invoices = String(invoices.length)
      if (invoices.length > 0) {
        debug.firstInvoiceRaw = JSON.stringify(invoices[0]).slice(0, 700)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const inv of invoices as any[]) {
        const nested = Array.isArray(inv?.orders) ? inv.orders : [inv]
        for (const o of nested) {
          const extId = String(o?.id ?? o?.orderId ?? '')
          if (!extId || extId === 'undefined' || fbsById.has(extId)) continue
          const orderShaped = o?.price != null || o?.totalPrice != null
            || o?.orderItems != null || o?.items != null || o?.status != null
          if (orderShaped) {
            fbsById.set(extId, o as UzumFbsOrder)
            fbsOk = true
          }
        }
      }
    } catch (e) {
      debug.invoices = e instanceof UzumApiError ? `HTTP ${e.status}` : String(e).slice(0, 80)
    }
    await pause()

    // NOTE: a status-less query with epoch-SECONDS dates was tried as a safety
    // net for unknown status names — it returned 200 with 0 orders even while
    // status=CANCELED returned a real order, so it sees nothing the status
    // sweep doesn't. Removed to save a request against the rate limit.

    // FBO: same, but if the key lacks FBO scope the first call returns 403
    // (RBAC) — stop immediately instead of repeating the denial for every status
    // (that just burns requests against the rate limit).
    const fboById = new Map<string, UzumFbsOrder>()
    for (const st of FBS_STATUSES) {
      try {
        const batch = await fetchAllPages(page => fetchUzumOrders(token, uzumShopIds, page, ORDERS_PAGE_SIZE, undefined, undefined, 'fbo', st))
        fboOk = true
        debug[`fbo_${st}`] = String(batch.length)
        for (const o of batch) fboById.set(extIdOf(o), o)
      } catch (e) {
        if (e instanceof UzumApiError && e.status === 403) {
          debug[`fbo_${st}`] = 'HTTP 403'
          warnings.push(`FBO: 403 (key lacks FBO scope) — skipped`)
          break
        }
        const msg = e instanceof UzumApiError ? `HTTP ${e.status} ${e.body?.slice(0, 120) ?? ''}` : String(e)
        debug[`fbo_${st}`] = msg
        warnings.push(`FBO ${st}: ${msg}`)
      }
      await pause()
    }

    const fbsOrders = [...fbsById.values()]
    const fboOrders = [...fboById.values()]
    const ordersDegraded = !fbsOk && !fboOk
    // Keep the first raw order visible in the sync result: if mapping/upserting
    // fails, the actual field names Uzum returned are the evidence we need.
    const firstRaw = fbsOrders[0] ?? fboOrders[0]
    if (firstRaw) debug.firstOrderRaw = JSON.stringify(firstRaw).slice(0, 800)
    // Tag each order with its fulfillment scheme so it can be distinguished
    // downstream. Deduplicate by id in case the FBO endpoint overlaps with FBS.
    const taggedOrders: { o: UzumFbsOrder; ff: string }[] = [
      ...fbsOrders.map(o => ({ o, ff: 'fbs' })),
      ...fboOrders
        .filter(o => !fbsOrders.some(f => extIdOf(f) === extIdOf(o)))
        .map(o => ({ o, ff: 'fbo' })),
    ]
    const uzumOrders: UzumFbsOrder[] = taggedOrders.map(t => t.o)

    // Known unit prices, for recovering real quantities from the order total:
    // per-SKU from the product sync, plus — when the shop sells at exactly one
    // price — that lone price for orders that arrive with no line items at all.
    const priceByMpid = new Map<string, number>()
    for (const r of productRows) {
      if (r.selling_price != null && r.selling_price > 0) {
        priceByMpid.set(String(r.marketplace_product_id), r.selling_price)
      }
    }
    const distinctPrices = [...new Set(priceByMpid.values())]
    const soloPrice = distinctPrices.length === 1 ? distinctPrices[0] : null

    // Average commission % across all known SKUs — fallback for orders with no items
    const commissionValues = [...commissionBySkuId.values()]
    const avgCommissionPct = commissionValues.length > 0
      ? commissionValues.reduce((s, v) => s + v, 0) / commissionValues.length
      : 0

    const orderRows = taggedOrders.map(({ o, ff }) => {
      // Support both new (id/dateCreated/price/orderItems) and legacy field names
      const extId = extIdOf(o)
      const orderedAt = parseOrderedAt(o.dateCreated ?? o.createdAt)
      const revenue = o.price ?? o.totalPrice ?? 0
      const allItems = o.orderItems ?? o.items ?? []
      const unitsFromTotal = allItems.length === 0 && soloPrice != null && revenue > 0 && revenue % soloPrice === 0
        ? revenue / soloPrice
        : null
      let feeCalc = 0
      let feeComplete = allItems.length > 0
      for (const it of allItems) {
        const rate = commissionBySkuId.get(String(it.skuId))
        if (rate == null) { feeComplete = false; break }
        feeCalc += it.price * effectiveQty(o, it, allItems.length, priceByMpid.get(String(it.skuId))) * rate / 100
      }
      const marketplace_fee = feeComplete && feeCalc > 0
        ? feeCalc
        : (allItems.length === 0 && avgCommissionPct > 0 && revenue > 0
          ? revenue * avgCommissionPct / 100
          : null)
      return {
        shop_id: shopId,
        order_id_external: extId,
        marketplace: 'uzum' as const,
        fulfillment_type: ff,
        status: (STATUS_MAP[o.status] ?? 'pending') as
          | 'pending'
          | 'confirmed'
          | 'delivered'
          | 'cancelled'
          | 'returned',
        revenue,
        marketplace_fee,
        // Units, not line items: an order of 2× one SKU must show 2, not 1.
        items_count: allItems.length > 0
          ? allItems.reduce((s, it) => s + effectiveQty(o, it, allItems.length, priceByMpid.get(String(it.skuId))), 0)
          : (unitsFromTotal ?? 1),
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
      ordersInserted = toInsOrd.length
      for (const r of toInsOrd) {
        if (r.status === 'pending' || r.status === 'confirmed') {
          newOrders.push(`#${r.order_id_external} — ${r.revenue} so'm, ${r.items_count} dona`)
        }
      }

      if (toInsOrd.length > 0) {
        for (let i = 0; i < toInsOrd.length; i += 500) {
          await db.insert(orders).values(toInsOrd.slice(i, i + 500).map(r => ({
            shop_id: r.shop_id,
            order_id_external: r.order_id_external,
            marketplace: r.marketplace,
            fulfillment_type: r.fulfillment_type,
            status: r.status,
            revenue: String(r.revenue),
            marketplace_fee: r.marketplace_fee != null ? String(r.marketplace_fee) : null,
            items_count: r.items_count,
            ordered_at: r.ordered_at,
          })))
        }
      }
      for (const r of toUpdOrd) {
        await db.update(orders).set({
          fulfillment_type: r.fulfillment_type,
          status: r.status,
          revenue: String(r.revenue),
          marketplace_fee: r.marketplace_fee != null ? String(r.marketplace_fee) : null,
          items_count: r.items_count,
          ordered_at: r.ordered_at,
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
                quantity_sold: null,
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
        // No date filter (broken on Uzum's side); enumerate statuses instead.
        const exById = new Map<string, UzumFbsOrder>()
        for (const type of ['fbs', 'fbo'] as const) {
          for (const st of FBS_STATUSES) {
            try {
              const batch = await fetchAllPages(p => fetchUzumOrders(token, uzumShopIds, p, ORDERS_PAGE_SIZE, undefined, undefined, type, st))
              for (const o of batch) exById.set(extIdOf(o), o)
            } catch { /* invalid status / no scope — skip */ }
          }
        }
        const extractOrders: UzumFbsOrder[] = [...exById.values()]
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
                  quantity_sold: null,
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
            const extIds = extractOrders.map(o => extIdOf(o))
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
              const dbOid = oMap.get(extIdOf(o))
              if (!dbOid) continue
              const lines = o.orderItems ?? o.items ?? []
              for (const it of lines) {
                itmRows.push({ order_id: dbOid, product_id: pMap.get(String(it.skuId)) ?? null, quantity: effectiveQty(o, it, lines.length), price_per_unit: it.price })
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
      const dbProducts = await db.select({ id: products.id, marketplace_product_id: products.marketplace_product_id, title: products.title, selling_price: products.selling_price })
        .from(products).where(eq(products.shop_id, shopId))
      const pidMap = new Map<string, string>()
      const titleMap = new Map<string, string>()
      const priceByDbId = new Map<string, number>()
      for (const p of dbProducts) {
        if (p.marketplace_product_id) pidMap.set(String(p.marketplace_product_id), p.id as string)
        if (p.title) titleMap.set(p.title.trim().toLowerCase(), p.id as string)
        const sp = p.selling_price != null ? Number(p.selling_price) : 0
        if (sp > 0) priceByDbId.set(p.id as string, sp)
      }
      // The order item's skuId doesn't always match the product API's skuId
      // (different id spaces). Fall back to title match, then — for a
      // single-product shop — to that lone product, so analytics never lose
      // the item to a null product_id.
      const resolveProductId = (it: UzumFbsOrderItem): string | null =>
        pidMap.get(String(it.skuId)) ??
        (it.productTitle ? titleMap.get(it.productTitle.trim().toLowerCase()) : undefined) ??
        (dbProducts.length === 1 ? dbProducts[0].id as string : null)

      // Map order_id_external → orders.id
      const extIds = uzumOrders.map(o => extIdOf(o))
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
        const extId = extIdOf(o)
        const dbOrderId = orderIdMap.get(extId)
        if (!dbOrderId) continue
        const lines = o.orderItems ?? o.items ?? []
        for (const it of lines) {
          const pid = resolveProductId(it)
          const productPrice = pid ? priceByDbId.get(pid) : undefined
          itemRows.push({
            order_id:       dbOrderId,
            product_id:     pid,
            quantity:       effectiveQty(o, it, lines.length, productPrice),
            price_per_unit: it.price > 0 ? it.price : (productPrice ?? 0),
          })
        }
        // Order arrived with no line items at all: in a single-product shop we
        // still know what was bought — synthesize the line from the order
        // total and the product's price so analytics see every order.
        if (lines.length === 0 && dbProducts.length === 1) {
          const pid = dbProducts[0].id as string
          const sp = priceByDbId.get(pid)
          const total = o.price ?? o.totalPrice ?? 0
          const qty = sp && total > 0 && total % sp === 0 ? total / sp : 1
          itemRows.push({ order_id: dbOrderId, product_id: pid, quantity: qty, price_per_unit: sp ?? total })
        }
      }
      const unmatched = itemRows.filter(r => r.product_id == null).length
      if (unmatched > 0) debug.itemsUnmatched = String(unmatched)

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
        itemsUpserted += itemRows.length
      }
    } catch (e) {
      // Best-effort, but never silent: analytics depend on order_items.
      warnings.push(`Order items: ${String(e).slice(0, 150)}`)
    }

    // ── Repair: orders without line items are invisible to per-product
    // analytics (products/analytics showed "in process 0" while an open order
    // existed). In a single-product shop the line is derivable from the
    // order's own items_count and revenue — synthesize it, and relink any
    // orphaned rows (product_id NULL from syncs that ran while the products
    // table was empty). Heals historical rows, not just the current fetch.
    try {
      const shopProds = await db.select({ id: products.id })
        .from(products).where(eq(products.shop_id, shopId))
      if (shopProds.length === 1) {
        const loneId = shopProds[0].id as string
        const allOrds = await db.select({ id: orders.id, items_count: orders.items_count, revenue: orders.revenue })
          .from(orders).where(eq(orders.shop_id, shopId))
        const shopOrderIds = allOrds.map(o => o.id as string)
        if (shopOrderIds.length > 0) {
          await db.update(orderItems).set({ product_id: loneId })
            .where(and(inArray(orderItems.order_id, shopOrderIds), sql`${orderItems.product_id} is null`))
          const withItems = await db.select({ order_id: orderItems.order_id })
            .from(orderItems).where(inArray(orderItems.order_id, shopOrderIds))
          const hasItems = new Set(withItems.map(r => r.order_id as string))
          const missing = allOrds.filter(o => !hasItems.has(o.id as string))
          if (missing.length > 0) {
            await db.insert(orderItems).values(missing.map(o => {
              const qty = o.items_count || 1
              const rev = Number(o.revenue ?? 0)
              return {
                order_id: o.id as string,
                product_id: loneId,
                quantity: qty,
                price_per_unit: String(qty > 0 ? rev / qty : rev),
              }
            }))
            itemsUpserted += missing.length
            debug.itemsRepaired = String(missing.length)
          }
        }
      }
    } catch (e) {
      warnings.push(`Items repair: ${String(e).slice(0, 120)}`)
    }

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

    // ── Finance data (real commission from Uzum) ────────────────────────────
    // Uzum's finance section shows real commission deductions per order.
    // Try to discover and call finance API endpoints to get real data instead
    // of relying on estimated percentages.
    try {
      const financePaths = await discoverUzumFinancePaths(token)
      const financeResult = await fetchUzumFinanceData(token, uzumShopIds, financePaths)
      Object.assign(debug, financeResult.debug)

      if (financeResult.entries.length > 0) {
        const financeByOrderId = new Map<string, { commission: number; delivery: number; netPayout: number }>()
        for (const e of financeResult.entries) {
          financeByOrderId.set(e.orderId, e)
        }
        if (financeByOrderId.size > 0) {
          const financeOrderIds = [...financeByOrderId.keys()]
          const dbFinanceOrders = await db.select({
            id: orders.id,
            order_id_external: orders.order_id_external,
            revenue: orders.revenue,
          }).from(orders).where(and(
            eq(orders.shop_id, shopId),
            inArray(orders.order_id_external, financeOrderIds),
          ))
          for (const dbOrd of dbFinanceOrders) {
            const fin = financeByOrderId.get(dbOrd.order_id_external as string)
            if (!fin) continue
            const commission = fin.commission > 0
              ? fin.commission
              : (fin.netPayout > 0 ? Number(dbOrd.revenue ?? 0) - fin.netPayout : 0)
            if (commission > 0 || fin.delivery > 0) {
              await db.update(orders).set({
                marketplace_fee: String(commission),
                ...(fin.delivery > 0 ? { delivery_cost: String(fin.delivery) } : {}),
              }).where(eq(orders.id, dbOrd.id))
            }
          }
          debug.financeOrdersUpdated = String(dbFinanceOrders.length)
        }
      } else if (financeResult.balance != null && financeResult.balance > 0) {
        const activeOrders = await db.select({
          id: orders.id,
          revenue: orders.revenue,
          marketplace_fee: orders.marketplace_fee,
        }).from(orders).where(and(
          eq(orders.shop_id, shopId),
          sql`${orders.marketplace_fee} is null or ${orders.marketplace_fee} = '0'`,
        ))
        const totalRevenue = activeOrders.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
        if (totalRevenue > 0 && totalRevenue > financeResult.balance) {
          const totalFee = totalRevenue - financeResult.balance
          const feeRate = totalFee / totalRevenue
          for (const o of activeOrders) {
            const rev = Number(o.revenue ?? 0)
            if (rev > 0) {
              await db.update(orders).set({
                marketplace_fee: String(Math.round(rev * feeRate)),
              }).where(eq(orders.id, o.id))
            }
          }
          debug.financeBalanceFallback = `balance=${financeResult.balance}, totalRev=${totalRevenue}, feeRate=${(feeRate * 100).toFixed(1)}%`
        }
      }
    } catch (e) {
      debug.financeError = String(e).slice(0, 200)
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
      itemsUpserted,
      ordersInserted,
      newOrders,
      details: warnings.length ? warnings.join(' | ') : undefined,
      debug,
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

    return { ok: false, ordersUpserted: 0, productsUpserted: 0, campaignsUpserted: 0, error: msg, debug }
  }
}
