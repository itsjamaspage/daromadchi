import { eq, ne, and, inArray, gte, lt, sql } from 'drizzle-orm'
import { db, shops as shopsTable, orders as ordersTable, orderItems as orderItemsTable, products as productsTable } from '@/lib/db'
import { computeStockGroups, lowStockGroups } from '@/lib/db/stock-groups'
import { notifT, fmtNumber, type NotifLang } from '@/lib/notif-i18n'

const MP_SHORT = { uzum: 'UZ', wildberries: 'WB', yandex_market: 'YM' } as const

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

  const shopRows = await db.select({ id: shopsTable.id }).from(shopsTable)
    .where(eq(shopsTable.user_id, s.user_id))
  const shopIds = shopRows.map(r => r.id)
  if (shopIds.length === 0) return null

  const parts: string[] = []

  // ── Daily summary (yesterday's sales) ──
  if (s.notif_daily_summary) {
    const day = await buildSalesSummary(shopIds, 1, lang)
    if (day) parts.push(`${t.dailyTitle}\n` + day)
  }

  // ── Weekly report (last 7 days, Mondays only) ──
  if (s.notif_weekly_report && includeWeekly) {
    const week = await buildSalesSummary(shopIds, 7, lang)
    if (week) parts.push(`${t.weeklyTitle(7)}\n` + week)
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
            .map(mp => `${MP_SHORT[mp]} ${g.stock_by_marketplace[mp]}`)
            .join(' · ')
          const days = g.days_of_stock !== null ? `, ${t.lowStockDays(g.days_of_stock)}` : ''
          return `• ${g.title} — ${t.lowStockTotal} <b>${g.leftover}</b> ${t.lowStockUnit}${perMp ? ` (${perMp})` : ''}${days}`
        }).join('\n')
        parts.push(`${t.lowStockTitle(low.length)}\n${lines}\n${t.lowStockCta}`)
      }
    } catch { /* leftover alerts are best-effort */ }
  }

  if (parts.length === 0) return null

  const text = parts.join('\n\n') + `\n\n${t.fullAnalytics}: https://daromadchi.uz/dashboard`
  return { text, headers: parts.map(p => p.split('\n')[0]) }
}

/**
 * Sales summary for the last `days` days. Includes order count, revenue,
 * total units sold, a per-category unit breakdown, and cancelled order count.
 * Cancelled/returned orders are excluded from sold totals but counted separately.
 */
async function buildSalesSummary(
  shopIds: string[],
  days: number,
  lang: NotifLang,
): Promise<string | null> {
  const t = notifT(lang)
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - days)
  const until = new Date()
  until.setHours(0, 0, 0, 0)

  const [orderRows, unitRows, catRows] = await Promise.all([
    // Order-level aggregates. status split so cancelled is counted separately.
    db.select({
      status: ordersTable.status,
      revenue: ordersTable.revenue,
    }).from(ordersTable)
      .where(and(
        inArray(ordersTable.shop_id, shopIds),
        gte(ordersTable.ordered_at, since),
        lt(ordersTable.ordered_at, until),
      )),
    // Total units sold on non-cancelled/returned orders.
    db.select({
      units: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
    }).from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
      .where(and(
        inArray(ordersTable.shop_id, shopIds),
        gte(ordersTable.ordered_at, since),
        lt(ordersTable.ordered_at, until),
        ne(ordersTable.status, 'cancelled'),
        ne(ordersTable.status, 'returned'),
      )),
    // Units per category (non-cancelled/returned).
    db.select({
      category: productsTable.category,
      units: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
    }).from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
      .leftJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
      .where(and(
        inArray(ordersTable.shop_id, shopIds),
        gte(ordersTable.ordered_at, since),
        lt(ordersTable.ordered_at, until),
        ne(ordersTable.status, 'cancelled'),
        ne(ordersTable.status, 'returned'),
      ))
      .groupBy(productsTable.category),
  ])

  const active    = orderRows.filter(o => o.status !== 'cancelled' && o.status !== 'returned')
  const cancelled = orderRows.filter(o => o.status === 'cancelled')

  if (active.length === 0 && cancelled.length === 0) {
    return t.noOrders
  }

  const revenue = active.reduce((sum, o) => sum + Number(o.revenue ?? 0), 0)
  const units   = Number(unitRows[0]?.units ?? 0)

  const lines: string[] = [
    `🛒 ${t.orders}: <b>${active.length}</b>`,
    `💰 ${t.revenue}: <b>${fmtNumber(revenue, lang)} ${t.som}</b>`,
  ]

  if (units > 0) {
    lines.push(`📦 ${t.unitsSold}: <b>${units}</b>`)

    const cats = catRows
      .map(c => ({ name: c.category?.trim() || t.uncategorized, units: Number(c.units) }))
      .filter(c => c.units > 0)
      .sort((a, b) => b.units - a.units)
      .slice(0, 5)
    if (cats.length > 0) {
      lines.push(`   <i>${t.byCategory}:</i>`)
      for (const c of cats) lines.push(`   • ${c.name}: ${c.units}`)
    }
  }

  if (cancelled.length > 0) {
    lines.push(`🚫 ${t.cancelled}: <b>${cancelled.length}</b>`)
  }

  return lines.join('\n')
}
