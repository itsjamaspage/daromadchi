/**
 * Load a period's orders in the shape the money rules expect.
 *
 * One query shape, one definition of the period, one definition of COGS — so
 * the dashboard, the P&L, the extension popup and the daily Telegram summary
 * cannot disagree about what a week earned. They did: three screens computed
 * profit three different ways over three different sets of orders.
 *
 * Two decisions live here rather than in each caller:
 *
 *   DELIVERED ONLY. Revenue is recognised on delivery — an order in transit has
 *   not earned anything yet, and one that is cancelled never will. The extension
 *   counted every non-cancelled order, so its "profit" included sales that had
 *   not happened.
 *
 *   COGS IS NULL WHEN ANY ITEM LACKS A COST. Not a partial sum: a total missing
 *   one product's cost is not a smaller cost, it is an unknown one. Summing the
 *   rest and calling it the cost is exactly how a product with no cost_price
 *   came to show 100% margin.
 */
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getSettlementNetByOrder } from '@/lib/db/real-financials'
import type { OrderInput } from '@/lib/money/order-economics'

export type LoadedOrder = OrderInput & {
  id: string
  /** Groups exclusions for the UI to name — the marketplace, in practice. */
  key: string
}

export async function loadOrderInputs(
  shopIds: string[],
  since: Date | null,
  until: Date | null,
): Promise<LoadedOrder[]> {
  if (shopIds.length === 0) return []

  const window = [
    inArray(orders.shop_id, shopIds),
    ...(since ? [gte(orders.ordered_at, since)] : []),
    ...(until ? [lte(orders.ordered_at, until)] : []),
    eq(orders.status, 'delivered'),
  ]

  const [rows, cogsRows, netByOrder] = await Promise.all([
    db.select({
      id: orders.id,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
      marketplace: orders.marketplace,
      // Raw SQL, not a Drizzle field, per convention 3 in ARCHITECTURE.md: the
      // deploy runs `next build` BEFORE applying migrations, so a schema field
      // for a column that does not exist yet would break the build on the very
      // deploy that adds it. Promote to the Drizzle schema once 086 is confirmed
      // applied in production.
      //
      // The coalesce is belt-and-braces: 086 is NOT NULL DEFAULT 'reported', so
      // no row can actually be null. It costs nothing and means this query does
      // not depend on that being true forever.
      fee_source: sql<string>`coalesce(fee_source, 'reported')`,
    }).from(orders).where(and(...window)),
    // Per order: the cost, and whether any line is missing one. A line with no
    // linked product counts as missing — an unidentified item's cost is not zero.
    db.select({
      order_id: orderItems.order_id,
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * ${products.cost_price}), 0)`,
      missing: sql<number>`count(*) filter (where ${products.cost_price} is null)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...window))
      .groupBy(orderItems.order_id),
    getSettlementNetByOrder(shopIds, since, until),
  ])

  const cogsByOrder = new Map(cogsRows.map(r => [
    r.order_id as string,
    Number(r.missing) > 0 ? null : Number(r.cogs),
  ]))

  return rows.map(r => ({
    id: r.id as string,
    key: String(r.marketplace),
    revenue: Number(r.revenue ?? 0),
    marketplaceFee: r.marketplace_fee != null ? Number(r.marketplace_fee) : null,
    feeSource: r.fee_source === 'derived' ? 'derived' as const : 'reported' as const,
    deliveryCost: r.delivery_cost != null ? Number(r.delivery_cost) : null,
    settlementNet: netByOrder.get(r.id as string) ?? null,
    // An order with NO items at all has no known cost — the same unknown, not a
    // free one. (It happens when item extraction failed for that order.)
    cogs: cogsByOrder.has(r.id as string) ? cogsByOrder.get(r.id as string)! : null,
  }))
}
