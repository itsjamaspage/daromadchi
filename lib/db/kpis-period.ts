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
  const [orderAgg, cogsAgg, unitAgg, deliveredOrders, missingCostAgg] = await Promise.all([
    db.select({
      total_revenue: sql<number>`coalesce(sum(${orders.revenue}::numeric) filter (where ${orders.status} = 'delivered'), 0)`,
      total_orders: sql<number>`count(*)`,
      cancelled_orders: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
    }).from(orders).where(and(...conditions)),
    // Per ORDER, not one total: an order whose money the marketplace has not
    // reported yet is left out of the profit entirely, and its cost has to leave
    // with it or the figure would carry a cost against income it excludes.
    db.select({
      order_id: orderItems.order_id,
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions, sql`${orders.status} = 'delivered'`))
      .groupBy(orderItems.order_id),
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
      marketplace: orders.marketplace,
    }).from(orders).where(and(...conditions, sql`${orders.status} = 'delivered'`)),
    // Products sold in this period with NO cost price entered. COGS treats a
    // missing cost as zero — the only arithmetic available — so those items
    // look like pure profit. The figure is not wrong so much as incomplete, and
    // the card has to say so rather than present it flat.
    db.select({
      products: sql<number>`count(distinct ${orderItems.product_id})`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(...conditions, sql`${orders.status} = 'delivered'`, sql`${products.cost_price} is null`)),
  ])

  const revenue = Number(orderAgg[0]?.total_revenue ?? 0)
  const cogsByOrder = new Map(cogsAgg.map(r => [r.order_id as string, Number(r.cogs)]))

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

  // ── Only money the marketplace has actually reported ────────────────────────
  // Yandex publishes commission ONLY in the netting report, days after delivery
  // — lib/yandex/sync.ts leaves marketplace_fee NULL until then, deliberately.
  // Treating that NULL as a zero fee returns the order's whole revenue as
  // profit, which is what put "Чистая прибыль = Общая выручка = 115 000" on a
  // sale nobody had been paid for yet. Uzum is the opposite: its settlement feed
  // carries commission and net from the moment the order is placed.
  //
  // So an order counts only when its money is KNOWN — a settlement row exists,
  // or a real fee was stored at sync time. Everything else is set aside as
  // pending, per marketplace, and named under the figure rather than folded
  // into it. The seller sees what is counted, what is waiting, and for how much.
  let netFromMarketplace = 0
  let cogs = 0
  let revenueCounted = 0
  const counted = new Set<string>()
  const pendingByMarketplace = new Map<string, { revenue: number; orders: number }>()

  for (const o of deliveredOrders) {
    const mp = String(o.marketplace)
    const rev = Number(o.revenue ?? 0)
    const real = netByOrder.get(o.id as string)
    const hasStoredFee = o.marketplace_fee != null

    if (real === undefined && !hasStoredFee) {
      const e = pendingByMarketplace.get(mp) ?? { revenue: 0, orders: 0 }
      e.revenue += rev; e.orders += 1
      pendingByMarketplace.set(mp, e)
      continue
    }

    counted.add(mp)
    revenueCounted += rev
    cogs += cogsByOrder.get(o.id as string) ?? 0
    netFromMarketplace += real !== undefined
      ? real
      : rev - Number(o.marketplace_fee ?? 0) - Number(o.delivery_cost ?? 0)
  }

  // Dashboard "Чистая прибыль" = what the marketplace pays out for the sales it
  // has reported on, minus what the seller paid for those goods.
  const profit = netFromMarketplace - cogs

  return {
    revenue,
    profit,
    // The parts the profit is made of, so the dashboard can show its working:
    // sales − cost of goods − what the marketplace kept = net. `fees` is derived
    // rather than queried, because it is exactly the gap between what the sale
    // was worth and what the marketplace paid out for it — whether that came
    // from a settlement or from the stored estimate.
    cogs,
    // Sales behind the profit — the counted subset, not every sale in the
    // period. The revenue CARD still shows every sale; this line explains the
    // profit under it, and the two would contradict each other otherwise.
    revenueCounted,
    fees: revenueCounted - netFromMarketplace,
    /** Marketplaces whose money is in the figure, and those still waiting. */
    countedMarketplaces: [...counted].sort(),
    pendingMarketplaces: [...pendingByMarketplace].map(([marketplace, v]) => ({
      marketplace, revenue: v.revenue, orders: v.orders,
    })).sort((a, b) => a.marketplace.localeCompare(b.marketplace)),
    missingCostProducts: Number(missingCostAgg[0]?.products ?? 0),
    orders: Number(orderAgg[0]?.total_orders ?? 0),
    cancelled: Number(orderAgg[0]?.cancelled_orders ?? 0),
    cancelledUnits: Number(unitAgg[0]?.units ?? 0),
  }
}
