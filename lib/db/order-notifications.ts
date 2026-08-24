/**
 * Orders the seller still has to pick, pack and ship — the "sales" half of the
 * notifications page.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The page's own subtitle promises "important inventory AND SALES events", and
 * until now it called exactly one source: getStockAlerts(). New-order
 * notifications existed only as Telegram messages, so a seller who did not
 * connect the bot — or simply opened the app instead of their phone — had no
 * way to see a new order at all.
 *
 * ── The predicate ───────────────────────────────────────────────────────────
 * orderNeedsFulfilment() reads the RAW marketplace status, never the
 * normalized `status` enum. That enum is a display bucket that collapses
 * "seller must ship" and "already in transit" into pending/confirmed; gating a
 * notification on it is the mistake that announced an unpaid, auto-cancelled
 * order as "collect and ship" (order 60767668482, #299). One shared definition
 * lives in lib/marketplace/fulfillment-statuses.ts so this list and the
 * Telegram alert cannot drift apart on what "needs shipping" means.
 *
 * ── Window ──────────────────────────────────────────────────────────────────
 * Bounded to the sync's own lookback. An order older than that is never
 * re-read (lib/yandex/sync.ts), so its status can never be corrected — an
 * unshippable ghost would otherwise sit at the top of this list forever,
 * exactly the ratchet that made displayed stock wrong (#316). Uzum re-reads
 * every order on every tick and so is not bounded; the shared helper knows
 * which marketplaces are which.
 */
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, shops, orders, orderItems } from '@/lib/db'
import { cache } from 'react'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { orderNeedsFulfilment } from '@/lib/marketplace/fulfillment-statuses'
import { isCorrectable } from '@/lib/marketplace/reserved-display'
import type { MarketplaceType } from '@/lib/types'

export interface OrderNotification {
  orderId: string
  externalId: string
  marketplace: MarketplaceType
  /** Raw marketplace status, so the UI can show WHY this needs action. */
  rawStatus: string | null
  itemsCount: number
  revenue: number
  orderedAt: string
  /** Item titles for the line under the heading; may be empty when a Yandex
   *  order's items never linked (see #309 — the snapshot columns were NULL). */
  itemTitles: string[]
  /** Whether the seller has already been told on Telegram. Lets the page mark
   *  an order the bot never announced, which is the case this feed exists for. */
  alerted: boolean
}

/** Hard cap. The page is a glance, not a work queue — the Orders page is the
 *  work queue. A seller with 400 open orders does not want 400 rows here, and
 *  the count is what the bell badge shows anyway. */
const MAX_ROWS = 50

// React-cached: the dashboard layout needs the COUNT for the bell badge and
// the page needs the ROWS, both in one render. Without this they would each run
// the same two queries.
export const getOrderNotifications = cache(async (): Promise<OrderNotification[]> => {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops).where(and(eq(shops.user_id, userId), eq(shops.is_active, true)))
  const shopIds = shopRows.map(s => s.id)
  if (shopIds.length === 0) return []

  // Deliberately NOT filtered on the normalized status in SQL: the raw status
  // is the authority, and the whitelist lives in one shared module rather than
  // being restated as a WHERE clause that could drift from it.
  const rows = await db.select({
    id: orders.id,
    externalId: orders.order_id_external,
    marketplace: orders.marketplace,
    rawStatus: orders.marketplace_status,
    itemsCount: orders.items_count,
    revenue: orders.revenue,
    orderedAt: orders.ordered_at,
    alertSentAt: orders.alert_sent_at,
  }).from(orders)
    .where(inArray(orders.shop_id, shopIds))
    .orderBy(desc(orders.ordered_at))
    .limit(500)

  const now = new Date()
  const actionable = rows.filter(r =>
    orderNeedsFulfilment({ marketplace: r.marketplace, marketplace_status: r.rawStatus })
    && isCorrectable(r.marketplace, r.orderedAt, now),
  ).slice(0, MAX_ROWS)

  if (actionable.length === 0) return []

  // One query for every line's titles rather than one per order.
  const titleRows = await db.select({
    orderId: orderItems.order_id,
    title: orderItems.title,
    qty: orderItems.quantity,
  }).from(orderItems).where(inArray(orderItems.order_id, actionable.map(r => r.id)))

  const titlesByOrder = new Map<string, string[]>()
  for (const t of titleRows) {
    if (!t.title) continue
    const arr = titlesByOrder.get(t.orderId) ?? []
    arr.push(t.qty > 1 ? `${t.title} × ${t.qty}` : t.title)
    titlesByOrder.set(t.orderId, arr)
  }

  return actionable.map(r => ({
    orderId: r.id,
    externalId: r.externalId ?? '',
    marketplace: r.marketplace as MarketplaceType,
    rawStatus: r.rawStatus,
    itemsCount: r.itemsCount ?? 0,
    revenue: r.revenue != null ? Number(r.revenue) : 0,
    orderedAt: r.orderedAt.toISOString(),
    itemTitles: titlesByOrder.get(r.id) ?? [],
    alerted: r.alertSentAt != null,
  }))
})

/** Count for the bell badge. Shares the cached result above, so asking for it
 *  in the layout costs nothing on top of the page's own render. */
export async function countOrderNotifications(): Promise<number> {
  return (await getOrderNotifications()).length
}
