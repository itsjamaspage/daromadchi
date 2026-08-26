/**
 * The dashboard KPI numbers for ONE period. Split out of kpis.ts so it can be
 * tested: kpis.ts reaches next/cache and the request-scoped shop context, which
 * a test runner cannot load, while the arithmetic here needs neither.
 *
 * Both bounds are required. The profit figure totals settlement buckets, and a
 * total with no right-hand bound is "everything from `since` until forever" —
 * which is what made a week with no orders display the whole later tail as
 * profit. See lib/db/kpis.integration.test.ts.
 */
import { inArray, gte, lte, and, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getRealFinancialsByBucket } from '@/lib/db/real-financials'

export async function fetchPeriodKpis(shopIds: string[], since: Date | null, until: Date | null) {
  // Orders KPI counts EVERY order received (a cancelled order still happened);
  // money figures recognize revenue on DELIVERY only — accrual basis, matching
  // the P&L page (Finding 1). An in-transit or pending order has not earned
  // anything yet, and a cancelled/returned order never will.
  const conditions = [
    inArray(orders.shop_id, shopIds),
  ]
  if (since) conditions.push(gte(orders.ordered_at, since))
  if (until) conditions.push(lte(orders.ordered_at, until))

  // COGS aggregated over DELIVERED orders in the same period so the Dashboard's
  // Чистая прибыль matches P&L / Payouts' "after everything" figure.
  const [orderAgg, cogsAgg, unitAgg] = await Promise.all([
    db.select({
      total_revenue: sql<number>`coalesce(sum(${orders.revenue}::numeric) filter (where ${orders.status} = 'delivered'), 0)`,
      // Estimate-only fallback: revenue − stored marketplace_fee − stored
      // delivery_cost. Overridden below with real settlement net when the
      // Yandex/Uzum settlement tables have any rows for this period.
      total_profit_estimate: sql<number>`coalesce(sum(${orders.revenue}::numeric - coalesce(${orders.marketplace_fee}::numeric, 0) - coalesce(${orders.delivery_cost}::numeric, 0)) filter (where ${orders.status} = 'delivered'), 0)`,
      total_orders: sql<number>`count(*)`,
      cancelled_orders: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
    }).from(orders).where(and(...conditions)),
    db.select({
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions, sql`${orders.status} = 'delivered'`)),
    // Cancelled UNITS (a single cancelled order can hold several items — users
    // think in items, so the KPI note shows both counts).
    db.select({
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(...conditions, sql`${orders.status} = 'cancelled'`)),
  ])

  // Sum real per-month settlement net across the period so "Чистая
  // прибыль" tracks what actually hits (or will hit) the seller's
  // balance, not the estimated marketplace_fee subtraction stored at
  // order-sync time. Fall back to the orders-table estimate when no
  // settlement rows exist for the period.
  const revenue = Number(orderAgg[0]?.total_revenue ?? 0)
  const cogs = Number(cogsAgg[0]?.cogs ?? 0)
  //
  // BOTH bounds matter here, because this is the one caller that TOTALS the
  // buckets instead of reading them back by key. Without `until` the sum ran
  // from the window's start to forever, so the KPI was "every settlement since
  // this Monday" minus "the COGS of this week" — two different periods
  // subtracted from each other. A week with no orders had no COGS to subtract
  // and so displayed the whole remaining tail as profit, and each earlier week
  // showed a bigger number than the one after it.
  const fromDate = since ?? new Date(0)
  const realBuckets = await getRealFinancialsByBucket(shopIds, fromDate, 'month', until)
  let realNet = 0
  let hasAnyReal = false
  for (const b of realBuckets.values()) {
    if (b.itemCount > 0) { hasAnyReal = true; realNet += b.net }
  }
  const netFromMarketplace = hasAnyReal ? realNet : Number(orderAgg[0]?.total_profit_estimate ?? 0)
  // Dashboard "Чистая прибыль" = what the marketplace pays out minus what
  // the seller paid for the goods. Matches P&L "Чистая после расходов".
  const profit = netFromMarketplace - cogs

  return {
    revenue,
    profit,
    orders: Number(orderAgg[0]?.total_orders ?? 0),
    cancelled: Number(orderAgg[0]?.cancelled_orders ?? 0),
    cancelledUnits: Number(unitAgg[0]?.units ?? 0),
  }
}
