/**
 * The dashboard KPI numbers for ONE period. Split out of kpis.ts so it can be
 * tested: kpis.ts reaches next/cache and the request-scoped shop context, which
 * a test runner cannot load, while the arithmetic here needs neither.
 *
 * ── One clock ───────────────────────────────────────────────────────────────
 * Every figure here is bucketed by the ORDER's date. Revenue and COGS always
 * were; the settlement money was not, and that mismatch is what made the profit
 * KPI describe a period nobody asked about. Settlements are dated when the
 * marketplace PAID, so a week with no sales showed +73 000 (payout money for
 * older sales, with no COGS to subtract) and a week with 200 000 of sales showed
 * −52 250 (its cost charged against settlements that had not arrived yet).
 *
 * Two invariants follow from putting the money on the sale's clock, and
 * kpis.integration.test.ts asserts both:
 *
 *   1. profit ≤ revenue, always. Profit is revenue minus costs and no cost is
 *      negative, so a profit above the period's own sales is arithmetically
 *      impossible — it can only mean money from outside the period leaked in.
 *   2. No timing-driven negatives. A period with no sales is 0, not a loss; a
 *      period with sales is only negative when the goods genuinely cost more
 *      than they sold for.
 */
import { inArray, gte, lte, and, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products } from '@/lib/db'
import { getSettlementNetByOrder } from '@/lib/db/real-financials'

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
  const [orderAgg, cogsAgg, unitAgg, deliveredOrders] = await Promise.all([
    db.select({
      total_revenue: sql<number>`coalesce(sum(${orders.revenue}::numeric) filter (where ${orders.status} = 'delivered'), 0)`,
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
    // Per-order money for the settlement attribution below. The stored fee and
    // delivery are the fallback for an order the marketplace has not settled.
    db.select({
      id: orders.id,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
    }).from(orders).where(and(...conditions, sql`${orders.status} = 'delivered'`)),
  ])

  const revenue = Number(orderAgg[0]?.total_revenue ?? 0)
  const cogs = Number(cogsAgg[0]?.cogs ?? 0)

  // What the marketplace actually paid for the sales made in THIS period,
  // order by order. Settlement rows carry the order they belong to, so the
  // money follows the sale rather than the payout run.
  //
  // Per-order, not per-period, because the fallback has to be per-order too: a
  // sale made yesterday has no settlement yet, and treating "no settlement" as
  // "earned nothing" would charge its COGS against zero income and invent a
  // loss — invariant 2, in the other direction. So an unsettled order falls
  // back to the estimate stored at sync time (revenue − fee − delivery), which
  // is what the whole period used to fall back to as a block.
  const netByOrder = await getSettlementNetByOrder(shopIds, since, until)
  let netFromMarketplace = 0
  for (const o of deliveredOrders) {
    const real = netByOrder.get(o.id as string)
    if (real !== undefined) {
      netFromMarketplace += real
      continue
    }
    const rev = Number(o.revenue ?? 0)
    const fee = Number(o.marketplace_fee ?? 0)
    const del = Number(o.delivery_cost ?? 0)
    netFromMarketplace += rev - fee - del
  }
  // Dashboard "Чистая прибыль" = what the marketplace pays out for this
  // period's sales, minus what the seller paid for those goods.
  const profit = netFromMarketplace - cogs

  return {
    revenue,
    profit,
    orders: Number(orderAgg[0]?.total_orders ?? 0),
    cancelled: Number(orderAgg[0]?.cancelled_orders ?? 0),
    cancelledUnits: Number(unitAgg[0]?.units ?? 0),
  }
}
