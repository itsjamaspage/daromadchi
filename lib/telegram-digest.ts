import { eq, and, inArray, gte, lt } from 'drizzle-orm'
import { db, shops as shopsTable, orders as ordersTable, orderItems as orderItemsTable, products as productsTable } from '@/lib/db'
import { computeStockGroups } from '@/lib/db/stock-groups'
import { COLOR_LABELS, type ColorKey, type BadgeLang } from '@/lib/products/resolveColor'
import { notifT, type NotifLang } from '@/lib/notif-i18n'

const MP_FLAG: Record<string, string> = {
  uzum:          '🟣UZ',
  yandex_market: '🟡YM',
}

export interface DigestUser {
  user_id:               string
  notif_low_stock:       boolean
  notif_daily_summary:   boolean
  notif_weekly_report:   boolean
  notif_lang:            string | null
  alert_stock_threshold: number | null
}

/**
 * Build the full digest message for a single user. Returns null when there is
 * nothing to send. Shared by the scheduled cron and the "send test" endpoint.
 */
export async function buildDigestForUser(
  s: DigestUser,
  includeWeekly: boolean,
): Promise<{ text: string; headers: string[] } | null> {
  const lang = (s.notif_lang ?? 'uz') as NotifLang
  const t = notifT(lang)

  const shopRows = await db.select({ id: shopsTable.id, marketplace: shopsTable.marketplace })
    .from(shopsTable)
    .where(eq(shopsTable.user_id, s.user_id))
  const shopIds = shopRows.map(r => r.id)
  if (shopIds.length === 0) return null

  const mpByShop = new Map<string, string>(shopRows.map(r => [r.id, r.marketplace]))

  const parts: string[] = []

  // ── Daily summary (yesterday's sales) ──
  if (s.notif_daily_summary) {
    const day = await buildSalesSummary(shopIds, mpByShop, 1, lang)
    if (day) parts.push(`${t.dailyTitle}\n` + day)

    const today = await buildSalesSummary(shopIds, mpByShop, 0, lang)
    if (today) parts.push(`${t.todayTitle}\n` + today)
  }

  // ── Weekly report (last 7 days, Mondays only) ──
  if (s.notif_weekly_report && includeWeekly) {
    const week = await buildSalesSummary(shopIds, mpByShop, 7, lang)
    if (week) parts.push(`${t.weeklyTitle(7)}\n` + week)
  }

  // ── Pending deliveries (FBS orders the seller must ship) ──
  if (s.notif_daily_summary) {
    const pending = await buildPendingDeliveries(shopIds, mpByShop, lang)
    if (pending) parts.push(pending)
  }

  // ── FBS stock update alerts (tell user to update other stores) ──
  if (s.notif_daily_summary) {
    try {
      const stockUpdate = await buildFbsStockUpdateAlerts(shopIds, mpByShop, s.user_id, lang)
      if (stockUpdate) parts.push(stockUpdate)
    } catch { /* best-effort */ }
  }

  // Low-stock section removed — it overlapped with "Update stocks" (FBS
  // stock update alerts), which is the more actionable of the two.
  // notif_low_stock preference is left in place for now; toggling it has no
  // effect on the digest.

  if (parts.length === 0) return null

  const text = parts.join('\n\n') + `\n\n${t.fullAnalytics}: https://daromadchi.uz/dashboard`
  return { text, headers: parts.map(p => p.split('\n')[0]) }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

/**
 * Sales summary for the last `days` days (days=0 → today so far).
 *
 * Lists the actual ORDERED PRODUCTS — one line per order item as
 * "<flag> <product name> · <colour> · <SKU> — <price>". Just the product
 * identity + the order price (no commission / profit analytics). Cancelled
 * orders are still tallied so a return/cancel isn't silently dropped.
 */
async function buildSalesSummary(
  shopIds: string[],
  mpByShop: Map<string, string>,
  days: number,
  lang: NotifLang,
): Promise<string | null> {
  const t = notifT(lang)
  const UZ_MS = 5 * 60 * 60_000
  const nowUz = new Date(Date.now() + UZ_MS)
  const midnightUz = new Date(Date.UTC(nowUz.getUTCFullYear(), nowUz.getUTCMonth(), nowUz.getUTCDate()))
  const midnightUtc = new Date(midnightUz.getTime() - UZ_MS)
  const since = new Date(midnightUtc.getTime() - days * 86_400_000)
  const until = days === 0 ? new Date() : midnightUtc

  // One row per order ITEM in the window, carrying the product's identity
  // (name, colour key, seller SKU) and its order's marketplace + status.
  const rows = await db.select({
    orderId: ordersTable.id,
    shop_id: ordersTable.shop_id,
    status: ordersTable.status,
    revenue: ordersTable.revenue,
    title: productsTable.title,
    sku: productsTable.sku,
    color: productsTable.variant_color,
    itemTitle: orderItemsTable.title,
    itemSku: orderItemsTable.sku,
    itemColor: orderItemsTable.variant_color,
    qty: orderItemsTable.quantity,
    unitPrice: orderItemsTable.price_per_unit,
  }).from(ordersTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.order_id, ordersTable.id))
    .leftJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
    .where(and(
      inArray(ordersTable.shop_id, shopIds),
      gte(ordersTable.ordered_at, since),
      lt(ordersTable.ordered_at, until),
    ))

  const active    = rows.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const cancelled = rows.filter(o => o.status === 'cancelled')

  if (active.length === 0 && cancelled.length === 0) {
    return days === 0 ? null : t.noOrders
  }

  const colorLabel = (key: string | null): string | null => {
    if (!key) return null
    const l = COLOR_LABELS[key as ColorKey]
    return l ? l[lang as BadgeLang] : null
  }

  // One line per ordered product: "<flag> <name> · <colour> · <SKU>". Fields
  // that are missing (no colour resolved, no SKU) are simply omitted so a line
  // is never padded with blanks. Capped so a busy window can't produce a wall.
  const fmtPrice = (n: number | null): string | null =>
    n != null && n > 0 ? `${Math.round(n).toLocaleString('ru-RU')} ${t.som}` : null

  // Prefer the identity snapshotted on the order item; fall back to the joined
  // product row (which is null when the item's skuId never linked to a product).
  const nameOf  = (o: typeof active[number]) => (o.itemTitle ?? o.title ?? '').trim()
  const skuOf   = (o: typeof active[number]) => (o.itemSku ?? o.sku ?? '').trim()
  const colorOf = (o: typeof active[number]) => o.itemColor ?? o.color

  const MAX_ITEMS = 30
  const withProduct = active.filter(o => nameOf(o) || skuOf(o))
  const lines: string[] = []
  for (const o of withProduct.slice(0, MAX_ITEMS)) {
    const flag = MP_FLAG[mpByShop.get(o.shop_id) ?? 'uzum'] ?? ''
    const name = nameOf(o)
    const sku = skuOf(o)
    const parts: string[] = [name || sku || '—']
    const c = colorLabel(colorOf(o))
    if (c) parts.push(c)
    // Only append the SKU when it isn't already the name we showed.
    if (sku && sku !== (name ?? '')) parts.push(sku)
    // Price: this item's line total (unit price × qty), else the order revenue.
    const linePrice = o.unitPrice != null
      ? Number(o.unitPrice) * (Number(o.qty) || 1)
      : (o.revenue != null ? Number(o.revenue) : null)
    const priceStr = fmtPrice(linePrice)
    let line = `${flag} ${parts.join(' · ')}`.trim()
    if (priceStr) line += ` — ${priceStr}`
    lines.push(line)
  }
  const remaining = withProduct.length - Math.min(withProduct.length, MAX_ITEMS)
  if (remaining > 0) lines.push(`… +${remaining}`)

  if (cancelled.length > 0) {
    lines.push(`🚫 ${t.cancelled}: ${new Set(cancelled.map(c => c.orderId)).size}`)
  }

  // Active orders exist but none carried a resolvable product (no items synced):
  // fall back to a non-empty acknowledgement rather than an empty section.
  if (lines.length === 0) return days === 0 ? null : t.noOrders

  return lines.join('\n')
}

/**
 * Pending orders that the seller needs to deliver to PVZ (pickup points).
 * Shows per-marketplace count of pending/confirmed orders.
 */
async function buildPendingDeliveries(
  shopIds: string[],
  mpByShop: Map<string, string>,
  lang: NotifLang,
): Promise<string | null> {
  const t = notifT(lang)

  // Match the dashboard's "В процессе" set — pending + confirmed. One row per
  // order ITEM so each line can name the ordered product (name · colour · SKU)
  // and its price, instead of a bare per-marketplace count.
  const rows = await db.select({
    orderId: ordersTable.id,
    shop_id: ordersTable.shop_id,
    fulfillment_type: ordersTable.fulfillment_type,
    revenue: ordersTable.revenue,
    title: productsTable.title,
    sku: productsTable.sku,
    color: productsTable.variant_color,
    itemTitle: orderItemsTable.title,
    itemSku: orderItemsTable.sku,
    itemColor: orderItemsTable.variant_color,
    qty: orderItemsTable.quantity,
    unitPrice: orderItemsTable.price_per_unit,
  }).from(ordersTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.order_id, ordersTable.id))
    .leftJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
    .where(and(
      inArray(ordersTable.shop_id, shopIds),
      inArray(ordersTable.status, ['pending', 'confirmed']),
    ))

  // Only FBS/DBS orders need the seller to ship to a PVZ.
  const fbs = rows.filter(o =>
    !o.fulfillment_type || o.fulfillment_type === 'fbs' || o.fulfillment_type === 'dbs')
  if (fbs.length === 0) return null

  const totalCount = new Set(fbs.map(o => o.orderId)).size

  const colorLabel = (key: string | null): string | null => {
    if (!key) return null
    const l = COLOR_LABELS[key as ColorKey]
    return l ? l[lang as BadgeLang] : null
  }
  const fmtPrice = (n: number | null): string | null =>
    n != null && n > 0 ? `${Math.round(n).toLocaleString('ru-RU')} ${t.som}` : null

  // One line per pending order item: "<flag> <name> · <colour> · <SKU> — <price>".
  const MAX_ITEMS = 30
  const lines: string[] = []
  for (const o of fbs.slice(0, MAX_ITEMS)) {
    const flag = MP_FLAG[mpByShop.get(o.shop_id) ?? 'uzum'] ?? ''
    // Prefer the identity snapshotted on the order item; fall back to the
    // joined product row.
    const name = (o.itemTitle ?? o.title ?? '').trim()
    const sku = (o.itemSku ?? o.sku ?? '').trim()
    const seg: string[] = [name || sku || '—']
    const c = colorLabel(o.itemColor ?? o.color)
    if (c) seg.push(c)
    if (sku && sku !== (name ?? '')) seg.push(sku)
    const linePrice = o.unitPrice != null
      ? Number(o.unitPrice) * (Number(o.qty) || 1)
      : (o.revenue != null ? Number(o.revenue) : null)
    const priceStr = fmtPrice(linePrice)
    let line = `${flag} ${seg.join(' · ')}`.trim()
    if (priceStr) line += ` — ${priceStr}`
    lines.push(line)
  }
  const remaining = fbs.length - Math.min(fbs.length, MAX_ITEMS)
  if (remaining > 0) lines.push(`… +${remaining}`)

  return `${t.deliveryTitle(totalCount)}\n${lines.join('\n')}`
}

/**
 * FBS stock update alerts: when an FBS order comes in on one marketplace,
 * the seller must manually update stock on the OTHER marketplaces that carry
 * the same product (since FBS = same physical pool, but each marketplace
 * tracks stock independently).
 *
 * Example: product listed FBS on UZ, YM, WB with stock=3. Order comes in on
 * YM → alert: "update stock to 2 on UZ, WB".
 */
async function buildFbsStockUpdateAlerts(
  shopIds: string[],
  mpByShop: Map<string, string>,
  userId: string,
  lang: NotifLang,
): Promise<string | null> {
  const t = notifT(lang)

  const groups = await computeStockGroups(userId, shopIds)

  // Find groups that have FBS members on 2+ marketplaces AND have in-process orders
  const alerts: { title: string; orderMp: string; newQty: number; targetMps: string[] }[] = []

  for (const g of groups) {
    const fbsMembers = g.members.filter(m =>
      m.fulfillment_type !== 'fbo' && m.fulfillment_type !== 'fby')

    // Need FBS members on at least 2 different marketplaces
    const fbsMps = new Set(fbsMembers.map(m => m.marketplace))
    if (fbsMps.size < 2) continue

    // Check for in-process orders — these represent recent orders that need
    // stock adjustment on other marketplaces
    if (g.total_in_process === 0) continue

    // The current leftover is already computed correctly (API stock - in_process)
    const newQty = g.leftover

    // Find which marketplaces had the orders (those with lower stock than the max)
    const maxStock = Math.max(0, ...fbsMembers.map(m => m.stock))
    const orderMps = fbsMembers
      .filter(m => m.stock < maxStock)
      .map(m => m.marketplace)
    const targetMps = fbsMembers
      .filter(m => !orderMps.includes(m.marketplace) || orderMps.length === 0)
      .map(m => m.marketplace)

    // If we can't determine which marketplace had the order, show all
    if (targetMps.length === 0 || orderMps.length === 0) continue

    const orderMpLabel = orderMps.map(mp => MP_FLAG[mp] ?? mp).join(', ')
    const targetMpLabels = targetMps.map(mp => MP_FLAG[mp] ?? mp)

    alerts.push({
      title: truncate(g.title, 30),
      orderMp: orderMpLabel,
      newQty: Math.max(0, newQty),
      targetMps: targetMpLabels,
    })
  }

  if (alerts.length === 0) return null

  const lines = alerts.slice(0, 10).map(a =>
    t.stockUpdateLine(a.title, a.orderMp, a.newQty, a.targetMps.join(', '))
  ).join('\n')

  return `${t.stockUpdateTitle(alerts.length)}\n${lines}\n${t.stockUpdateCta}`
}
