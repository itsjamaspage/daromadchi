import { eq, and, inArray, gte, lt } from 'drizzle-orm'
import { db, shops as shopsTable, orders as ordersTable, userSettings as userSettingsTable } from '@/lib/db'
import { computeStockGroups, lowStockGroups } from '@/lib/db/stock-groups'
import { notifT, fmtNumber, type NotifLang } from '@/lib/notif-i18n'

const MP_FLAG: Record<string, string> = {
  uzum:          '🟣UZ',
  wildberries:   '🟣WB',
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

  const [ueRow] = await db.select({ commPct: userSettingsTable.ue_comm_pct })
    .from(userSettingsTable).where(eq(userSettingsTable.user_id, s.user_id))
  const commPct = ueRow ? Number(ueRow.commPct) : 10

  const parts: string[] = []

  // ── Daily summary (yesterday's sales) ──
  if (s.notif_daily_summary) {
    const day = await buildSalesSummary(shopIds, mpByShop, 1, lang, commPct)
    if (day) parts.push(`${t.dailyTitle}\n` + day)

    const today = await buildSalesSummary(shopIds, mpByShop, 0, lang, commPct)
    if (today) parts.push(`${t.todayTitle}\n` + today)
  }

  // ── Weekly report (last 7 days, Mondays only) ──
  if (s.notif_weekly_report && includeWeekly) {
    const week = await buildSalesSummary(shopIds, mpByShop, 7, lang, commPct)
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

  // ── Low-stock alerts (total leftover across all marketplaces) ──
  if (s.notif_low_stock) {
    const threshold = s.alert_stock_threshold ?? 15
    try {
      const groups = await computeStockGroups(s.user_id, shopIds)
      const low = lowStockGroups(groups, threshold).slice(0, 10)
      if (low.length > 0) {
        const lines = low.map(g => {
          const perMp = (['uzum', 'wildberries', 'yandex_market'] as const)
            .filter(mp => mp in g.stock_by_marketplace)
            .map(mp => `${MP_FLAG[mp]} ${g.stock_by_marketplace[mp]}`)
            .join(' · ')
          const days = g.days_of_stock !== null ? `, ${t.lowStockDays(g.days_of_stock)}` : ''
          return `• ${truncate(g.title, 35)} — <b>${g.leftover}</b> ${t.lowStockUnit} (${perMp})${days}`
        }).join('\n')
        parts.push(`${t.lowStockTitle(low.length)}\n${lines}\n${t.lowStockCta}`)
      }
    } catch { /* leftover alerts are best-effort */ }
  }

  if (parts.length === 0) return null

  const text = parts.join('\n\n') + `\n\n${t.fullAnalytics}: https://daromadchi.uz/dashboard`
  return { text, headers: parts.map(p => p.split('\n')[0]) }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

/**
 * Sales summary for the last `days` days (days=0 → today so far).
 * Now includes per-marketplace breakdown and estimated profit.
 */
async function buildSalesSummary(
  shopIds: string[],
  mpByShop: Map<string, string>,
  days: number,
  lang: NotifLang,
  commPct: number,
): Promise<string | null> {
  const t = notifT(lang)
  const UZ_MS = 5 * 60 * 60_000
  const nowUz = new Date(Date.now() + UZ_MS)
  const midnightUz = new Date(Date.UTC(nowUz.getUTCFullYear(), nowUz.getUTCMonth(), nowUz.getUTCDate()))
  const midnightUtc = new Date(midnightUz.getTime() - UZ_MS)
  const since = new Date(midnightUtc.getTime() - days * 86_400_000)
  const until = days === 0 ? new Date() : midnightUtc

  const orderRows = await db.select({
    id: ordersTable.id,
    shop_id: ordersTable.shop_id,
    status: ordersTable.status,
    revenue: ordersTable.revenue,
    marketplace_fee: ordersTable.marketplace_fee,
    delivery_cost: ordersTable.delivery_cost,
    order_id_external: ordersTable.order_id_external,
  }).from(ordersTable)
    .where(and(
      inArray(ordersTable.shop_id, shopIds),
      gte(ordersTable.ordered_at, since),
      lt(ordersTable.ordered_at, until),
    ))

  const active    = orderRows.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const cancelled = orderRows.filter(o => o.status === 'cancelled')

  if (active.length === 0 && cancelled.length === 0) {
    return days === 0 ? null : t.noOrders
  }

  // Per-marketplace aggregation
  const mpStats = new Map<string, { orders: number; revenue: number; fee: number; delivery: number }>()
  for (const o of active) {
    const mp = mpByShop.get(o.shop_id) ?? 'uzum'
    const s = mpStats.get(mp) ?? { orders: 0, revenue: 0, fee: 0, delivery: 0 }
    s.orders += 1
    s.revenue += Number(o.revenue ?? 0)
    s.fee += Number(o.marketplace_fee ?? 0)
    s.delivery += Number(o.delivery_cost ?? 0)
    mpStats.set(mp, s)
  }

  const totalRevenue = active.reduce((s, o) => s + Number(o.revenue ?? 0), 0)
  const totalFee = active.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const totalDelivery = active.reduce((s, o) => s + Number(o.delivery_cost ?? 0), 0)
  const estimatedFee = totalFee > 0 ? totalFee : totalRevenue * commPct / 100
  const profit = totalRevenue - estimatedFee - totalDelivery
  const isEstimated = totalFee === 0 && totalRevenue > 0

  const lines: string[] = []

  // Per-marketplace order lines
  for (const [mp, s] of Array.from(mpStats.entries()).sort((a, b) => b[1].revenue - a[1].revenue)) {
    const flag = MP_FLAG[mp] ?? mp
    const fee = s.fee > 0 ? s.fee : s.revenue * commPct / 100
    lines.push(`${flag}: <b>${s.orders}</b> ${t.orders.toLowerCase()} · ${fmtNumber(s.revenue, lang)} ${t.som} (−${fmtNumber(fee, lang)} ${t.commission.toLowerCase()})`)
  }

  // Totals
  if (mpStats.size > 1 || active.length > 0) {
    const approx = isEstimated ? '≈ ' : ''
    lines.push(`💰 ${t.revenue}: <b>${fmtNumber(totalRevenue, lang)} ${t.som}</b>`)
    lines.push(`📈 ${t.profit}: <b>${approx}${fmtNumber(profit, lang)} ${t.som}</b>`)
  }

  if (cancelled.length > 0) {
    lines.push(`🚫 ${t.cancelled}: ${cancelled.length}`)
  }

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

  const pendingOrders = await db.select({
    id: ordersTable.id,
    shop_id: ordersTable.shop_id,
    status: ordersTable.status,
    fulfillment_type: ordersTable.fulfillment_type,
    items_count: ordersTable.items_count,
  }).from(ordersTable)
    .where(and(
      inArray(ordersTable.shop_id, shopIds),
      inArray(ordersTable.status, ['pending', 'confirmed']),
    ))

  // Only FBS orders need seller delivery to PVZ
  const fbsOrders = pendingOrders.filter(o =>
    !o.fulfillment_type || o.fulfillment_type === 'fbs' || o.fulfillment_type === 'dbs')

  if (fbsOrders.length === 0) return null

  const byMp = new Map<string, { count: number; items: number }>()
  for (const o of fbsOrders) {
    const mp = mpByShop.get(o.shop_id) ?? 'uzum'
    const s = byMp.get(mp) ?? { count: 0, items: 0 }
    s.count += 1
    s.items += o.items_count
    byMp.set(mp, s)
  }

  const totalCount = fbsOrders.length
  const lines = Array.from(byMp.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([mp, s]) => `  ${MP_FLAG[mp] ?? mp}: <b>${s.count}</b> (${s.items} ${t.lowStockUnit})`)

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
