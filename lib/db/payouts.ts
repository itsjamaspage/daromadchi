import { inArray, gte, and, ne, eq, sql, asc, type AnyColumn } from 'drizzle-orm'
import { db, orders, orderItems, products, shops, uzumSettlementOrders } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { PayoutEntry, PayoutOrderItem, PayoutOrderLine } from '@/lib/types'
import { isoWeekKey, currentIsoWeekKey, addMonths } from '@/lib/period-week'

// The period bucket, defined ONCE.
//
// Postgres requires a non-aggregated select expression to appear verbatim in
// GROUP BY. Writing the to_char() twice — once in each place — is a standing
// invitation to change one and not the other, and that is precisely how the
// weekly migration broke this page: the SELECT became ISO weeks while the
// GROUP BY stayed on 'YYYY-MM', so every query here failed with "column
// orders.ordered_at must appear in the GROUP BY clause". Call this in both
// positions and they cannot drift.
//
// IYYY-"W"IW is ISO-8601: weeks run Monday→Sunday and belong to the year
// containing their Thursday. lib/period-week.ts reproduces it in JS and is
// verified against this exact expression.
import { deriveUzumBucketStatus, rollUpUzumOrderStatus } from '@/lib/db/payout-status'

// AT TIME ZONE 'Asia/Tashkent' so the bucket is the SELLER's week, matching
// isoWeekKey in lib/period-week.ts byte-for-byte. Without the cast Postgres uses
// the session zone (UTC in production), which puts an order placed at 02:00
// Monday Tashkent — 21:00 Sunday UTC — in the PREVIOUS week's payout row.
const weekBucket = (col: AnyColumn) =>
  sql<string>`to_char(${col} AT TIME ZONE 'Asia/Tashkent', 'IYYY-"W"IW')`

export type { PayoutEntry }

export async function getPayoutEntries(range?: { from?: string; to?: string }): Promise<PayoutEntry[]> {
  const ue = await getUnitEcoSettings()
  const allShopIds = await getShopIds()
  if (!allShopIds || allShopIds.length === 0) return []

  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops)
    .where(inArray(shops.id, allShopIds))
  const mpByShop = new Map(shopRows.map(r => [r.id, r.marketplace]))

  // Clamped — see lib/period-week.ts. On a month-end day the old form skipped a
  // month, silently narrowing the payout horizon.
  const since = addMonths(new Date(), -12)
  // Widen the query horizon if a custom range reaches further back than 12 months,
  // so a hand-picked older range still has data to filter.
  if (range?.from) {
    const rf = new Date(range.from)
    if (!Number.isNaN(rf.getTime()) && rf < since) since.setTime(rf.getTime())
  }

  const [orderRows, cogsRows, itemRows] = await Promise.all([
    db.select({
      shop_id: orders.shop_id,
      order_id_external: orders.order_id_external,
      ordered_at: orders.ordered_at,
      status: orders.status,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
      penalty: orders.penalty,
      storage_fee: orders.storage_fee,
      additional_payment: orders.additional_payment,
    }).from(orders)
      .where(and(
        inArray(orders.shop_id, allShopIds),
        gte(orders.ordered_at, since),
      ))
      .orderBy(asc(orders.ordered_at)),
    db.select({
      period: weekBucket(orders.ordered_at).as('period'),
      marketplace: orders.marketplace,
      // Sum only the items whose cost is known, and count the ones whose is
      // not. Defaulting a missing cost to 0 made an uncosted product look like
      // pure profit in the payout line — the same coercion this project's money
      // module exists to stop (see lib/money/order-economics.ts).
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * ${products.cost_price}) filter (where ${products.cost_price} is not null), 0)`.as('cogs'),
      cogs_missing: sql<number>`count(*) filter (where ${products.cost_price} is null)`.as('cogs_missing'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(
        inArray(orders.shop_id, allShopIds),
        gte(orders.ordered_at, since),
        ne(orders.status, 'cancelled'),
        ne(orders.status, 'returned'),
      ))
      .groupBy(weekBucket(orders.ordered_at), orders.marketplace),
    // Per-product breakdown per period+marketplace. Aggregated in SQL so
    // 100 orders of the same SKU collapse to one row before it ever hits
    // the Node side. Cancelled/returned excluded — they don't contribute
    // to payout revenue.
    db.select({
      period: weekBucket(orders.ordered_at).as('period'),
      marketplace: orders.marketplace,
      productId: orderItems.product_id,
      productTitle: products.title,
      sku: products.sku,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
      revenue: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${orderItems.price_per_unit}, 0)), 0)`.as('revenue'),
      orderCount: sql<number>`count(distinct ${orders.id})`.as('order_count'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(
        inArray(orders.shop_id, allShopIds),
        gte(orders.ordered_at, since),
        ne(orders.status, 'cancelled'),
        ne(orders.status, 'returned'),
      ))
      .groupBy(
        weekBucket(orders.ordered_at),
        orders.marketplace,
        orderItems.product_id,
        products.title,
        products.sku,
      ),
  ])

  if (orderRows.length === 0) return []

  const cogsMap = new Map(cogsRows.map(r => [`${r.period}|${r.marketplace}`, Number(r.cogs)]))
  // Period+marketplace pairs holding at least one item with no cost price:
  // their `cogs` is a floor and the netPayout computed from it is a ceiling.
  const cogsPendingKeys = new Set(
    cogsRows.filter(r => Number(r.cogs_missing) > 0).map(r => `${r.period}|${r.marketplace}`),
  )

  const itemsMap = new Map<string, PayoutOrderItem[]>()
  for (const r of itemRows) {
    const key = `${r.period}|${r.marketplace}`
    const list = itemsMap.get(key) ?? []
    list.push({
      productTitle: r.productTitle ?? '—',
      sku:          r.sku ?? null,
      qty:          Number(r.qty),
      revenue:      Number(r.revenue),
      orderCount:   Number(r.orderCount),
    })
    itemsMap.set(key, list)
  }
  for (const list of itemsMap.values()) list.sort((a, b) => b.revenue - a.revenue)

  type Bucket = {
    revenue: number; realFee: number; realDelivery: number
    penalty: number; storageFee: number; additionalPayment: number
    count: number
    firstOrderAt: Date | null; lastOrderAt: Date | null
    orderNumbers: string[]
  }
  const grouped = new Map<string, Bucket>()

  for (const row of orderRows) {
    if (row.status === 'cancelled') continue

    const d = row.ordered_at
    // Must produce byte-identical keys to the to_char(…, 'IYYY-"W"IW') buckets
    // above — a JS week and a SQL week that disagree would split one period into
    // two rows. lib/period-week.ts is verified against Postgres for both year
    // boundaries; see its tests.
    const weekKey = isoWeekKey(d)
    const mp = mpByShop.get(row.shop_id) ?? 'uzum'
    const key = `${weekKey}|${mp}`
    const b = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0,
      penalty: 0, storageFee: 0, additionalPayment: 0,
      count: 0,
      firstOrderAt: null, lastOrderAt: null,
      orderNumbers: [],
    }

    if (row.status === 'returned') {
      // Returns are already accounted for inside settlement data (Uzum:
      // CANCELED rows are skipped entirely). Counting them here as a
      // retail-price deduction
      // was a phantom — it inflated "Удержано маркетплейсом" by a number
      // that was never actually subtracted from the seller's payout.
      // Skip returned orders: they contribute nothing to the payout.
    } else {
      b.revenue += Number(row.revenue ?? 0)
      // money-guard-ok: null fee triggers the estimation fallback (line 587) — zero means "use estimate", not "charged nothing"
      b.realFee += Number(row.marketplace_fee ?? 0)
      // money-guard-ok: null delivery triggers the estimation fallback (line 589) — zero means "use estimate", not "free shipping"
      b.realDelivery += Number(row.delivery_cost ?? 0)
      b.penalty += Number(row.penalty ?? 0)
      b.storageFee += Number(row.storage_fee ?? 0)
      b.additionalPayment += Number(row.additional_payment ?? 0)
      b.count += 1
      if (row.order_id_external) b.orderNumbers.push(row.order_id_external)
      if (!b.firstOrderAt || d < b.firstOrderAt) b.firstOrderAt = d
      if (!b.lastOrderAt  || d > b.lastOrderAt)  b.lastOrderAt  = d
    }
    grouped.set(key, b)
  }

  function isoDate(d: Date | null): string | null {
    return d ? d.toISOString().slice(0, 10) : null
  }

  const now = new Date()
  const currentWeek = currentIsoWeekKey(now)

  // Uzum real-settlement aggregation.
  // /v1/finance/orders returns per-order-item rows with authoritative
  // sellerPrice / commission / logisticDeliveryFee / withdrawnProfit,
  // so we sum by (shop_id × YYYY-MM) and use those instead of the
  // Unit-Economics-percentage estimate.
  const uzShopIds = shopRows.filter(r => r.marketplace === 'uzum').map(r => r.id)
  const uzSettlementByKey = new Map<string, { gross: number; commission: number; delivery: number; net: number; profitFallback: number; itemCount: number; statuses: Set<string>; orderNumbers: Set<string>; orderLines: Map<string, { name: string | null; gross: number; commission: number; delivery: number; withdrawn: number; profit: number; statuses: Set<string> }> }>()
  if (uzShopIds.length > 0) {
    try {
      const settlementRows = await db.select({
        period:           weekBucket(uzumSettlementOrders.transaction_at).as('period'),
        status:           uzumSettlementOrders.status,
        uzum_order_id:    uzumSettlementOrders.uzum_order_id,
        product_title:    uzumSettlementOrders.product_title,
        seller_price:     uzumSettlementOrders.seller_price,
        commission:       uzumSettlementOrders.commission,
        delivery:         uzumSettlementOrders.logistic_delivery_fee,
        withdrawn_profit: uzumSettlementOrders.withdrawn_profit,
        seller_profit:    uzumSettlementOrders.seller_profit,
      }).from(uzumSettlementOrders)
        .where(and(
          inArray(uzumSettlementOrders.shop_id, uzShopIds),
          gte(uzumSettlementOrders.transaction_at, since),
        ))
      for (const r of settlementRows) {
        if (!r.period) continue
        // Skip cancelled — Uzum sends them with sellerPrice > 0 too, but
        // the seller receives nothing and pays nothing on these.
        if (r.status === 'CANCELED') continue
        const key = `${r.period}|uzum`
        const b = uzSettlementByKey.get(key) ?? { gross: 0, commission: 0, delivery: 0, net: 0, profitFallback: 0, itemCount: 0, statuses: new Set<string>(), orderNumbers: new Set<string>(), orderLines: new Map<string, { name: string | null; gross: number; commission: number; delivery: number; withdrawn: number; profit: number; statuses: Set<string> }>() }
        b.itemCount += 1
        // Track the per-order finance/orders status so the bucket status is
        // rolled up from real signals (TO_WITHDRAW vs PROCESSING), never the
        // calendar. CANCELED is already skipped above.
        if (r.status) b.statuses.add(r.status)
        // Order number from the Finance section (/v1/finance/orders) — matches
        // Uzum's «Финансы» view, not the Orders feed.
        const uzOrderNum = r.uzum_order_id != null ? String(r.uzum_order_id) : ''
        if (uzOrderNum) b.orderNumbers.add(uzOrderNum)
        const sellerPrice = Number(r.seller_price ?? 0)
        const comm        = Number(r.commission   ?? 0)
        const deliv       = Number(r.delivery     ?? 0)
        b.gross      += sellerPrice
        b.commission += comm
        b.delivery   += deliv
        // Prefer withdrawnProfit (what actually hit the seller's balance)
        // and fall back to sellerProfit (pre-withdrawal profit) if the
        // former is still null for a fresh row.
        const withdrawn = r.withdrawn_profit != null ? Number(r.withdrawn_profit) : null
        const profit    = r.seller_profit    != null ? Number(r.seller_profit)    : null
        if (withdrawn != null) b.net += withdrawn
        if (profit    != null) b.profitFallback += profit
        // Per-order accumulation — the finance/orders feed already carries the
        // product title, so Uzum orders are named directly (no SKU→title lookup).
        if (uzOrderNum) {
          const line = b.orderLines.get(uzOrderNum) ?? { name: null, gross: 0, commission: 0, delivery: 0, withdrawn: 0, profit: 0, statuses: new Set<string>() }
          // THIS order's own statuses. The bucket's set cannot describe one
          // order: a month holds several, and they differ.
          if (r.status) line.statuses.add(r.status)
          if (!line.name && r.product_title) line.name = r.product_title
          line.gross      += sellerPrice
          line.commission += comm
          line.delivery   += deliv
          if (withdrawn != null) line.withdrawn += withdrawn
          if (profit    != null) line.profit    += profit
          b.orderLines.set(uzOrderNum, line)
        }
        uzSettlementByKey.set(key, b)
      }
    } catch (e) {
      console.error('[payouts] uzum_settlement_orders query failed:', String(e).slice(0, 200))
    }
  }

  const entries: PayoutEntry[] = Array.from(grouped.entries()).flatMap(([key, v]) => {
    const [weekKey, mp] = key.split('|')
    // Computed once at the top because every branch below builds a PayoutEntry
    // and all of them carry the same answer for this period+marketplace: does
    // its COGS cover everything that sold, or only the costed part?
    const cogsPartial = cogsPendingKeys.has(key)

    // Uzum real-settlement branch. Prefer /v1/finance/orders data when
    // we have any items in this month — it carries Uzum's authoritative
    // commission + delivery + net, so we stop estimating from the
    // Unit-Economics percentages.
    if (mp === 'uzum') {
      const settled = uzSettlementByKey.get(key)
      if (settled && settled.itemCount > 0) {
        // Net: withdrawnProfit when present (money actually released),
        // else sellerProfit (pre-release), else derive from
        // sellerPrice − commission − delivery. Prefer the one that
        // most closely matches what Uzum's own UI displays.
        const derivedNet = settled.gross - settled.commission - settled.delivery
        const net = settled.net > 0 ? settled.net
                  : settled.profitFallback > 0 ? settled.profitFallback
                  : derivedNet
        // Per-order named breakdown from /v1/finance/orders: each order number
        // with its product name and net, mirroring the bucket's net logic
        // (withdrawn → profit → gross−commission−delivery). Biggest net first.
        const orderLines: PayoutOrderLine[] = [...settled.orderLines.entries()]
          .map(([number, l]) => ({
            number,
            name: l.name ?? null,
            net: l.withdrawn > 0 ? l.withdrawn
               : l.profit > 0 ? l.profit
               : l.gross - l.commission - l.delivery,
            // Uzum publishes no per-order transfer signal to this token — no
            // payout resource exists in its API at all (§9.5) — so no Uzum
            // order can be proven paid. This stays the bucket's PayoutStatus
            // because every KPI totals from it and none of them may move.
            status: deriveUzumBucketStatus([...settled.statuses]),
            // What the badge actually shows: Uzum's own state for THIS order,
            // not the month's. Rolled up across the order's items.
            uzumStatus: rollUpUzumOrderStatus([...l.statuses]),
          }))
          .sort((a, b) => b.net - a.net)
        const uzGross = settled.gross || v.revenue
        const uzReconDelta = Math.round((uzGross - settled.commission - settled.delivery - 0 - net) * 100) / 100
        const entry: PayoutEntry = {
          id: key,
          period: weekKey,
          marketplace: mp,
          grossRevenue: uzGross,
          commission: settled.commission,
          delivery: settled.delivery,
          adSpend: 0,
          acquiring: 0,
          tax: 0,
          penalty: v.penalty,
          storageFee: v.storageFee,
          additionalPayment: v.additionalPayment,
          otherDeductions: 0,
          netPayout: net,
          ordersCount: settled.orderNumbers.size || v.count,
          orderNumbers: [...settled.orderNumbers],
          orders: orderLines,
          reconciliationDelta: uzReconDelta,
          // Status from REAL Uzum order signals, never the calendar: any
          // TO_WITHDRAW → available_to_withdraw (earned, not withdrawn), else
          // pending. Never 'paid' — no accessible completed-withdrawal feed.
          status: deriveUzumBucketStatus([...settled.statuses]),
          // Display only — the period badge. KPIs read `status` above.
          uzumStatus: rollUpUzumOrderStatus([...settled.statuses]),
          payoutDate: null,
          payoutEstimated: false,
          items: itemsMap.get(key) ?? [],
          firstOrderDate: isoDate(v.firstOrderAt),
          lastOrderDate:  isoDate(v.lastOrderAt),
          awaitingSettlement: false,
          cogsPartial,
        }
        return [entry]
      }
    }

    const estimated = v.realFee === 0 && v.revenue > 0
    const commission = estimated ? v.revenue * ue.defaultCommissionPct / 100 : v.realFee
    const delivery = v.realDelivery > 0 ? v.realDelivery : v.revenue * ue.lastMilePct / 100
    // Acquiring is bundled into marketplace commission. Only add as
    // separate estimate when commission itself is estimated.
    const acquiring = estimated ? v.revenue * ue.acquiringPct / 100 : 0
    const tax = v.revenue * ue.taxPct / 100
    const adSpend = 0
    const cogs = cogsMap.get(key) ?? 0
    const penalty = v.penalty
    const storageFee = v.storageFee
    const additionalPayment = v.additionalPayment
    const netPayout = v.revenue - commission - delivery - acquiring - tax - adSpend - cogs - penalty - storageFee - additionalPayment

    const isPast = weekKey < currentWeek
    const entry: PayoutEntry = {
      id: key,
      period: weekKey,
      marketplace: mp,
      grossRevenue: v.revenue,
      commission,
      delivery,
      adSpend,
      acquiring,
      tax,
      penalty,
      storageFee,
      additionalPayment,
      otherDeductions: cogs,
      netPayout,
      ordersCount: v.count,
      orderNumbers: v.orderNumbers,
      // No settlement data for this bucket, so nothing PROVES the money moved.
      //
      // This used to read `isPast ? 'estimated_paid' : ...`, which called a month
      // paid on its age alone — a Uzum payout that failed and was reversed still
      // showed as «Выплачено» because nothing here consults payout outcomes at
      // all. Age is not a settlement signal, so it no longer produces one.
      status: isPast ? 'pending' : 'estimated_pending',
      payoutDate: null,
      payoutEstimated: true,
      items: itemsMap.get(key) ?? [],
      firstOrderDate: isoDate(v.firstOrderAt),
      lastOrderDate:  isoDate(v.lastOrderAt),
      awaitingSettlement: false,
      cogsPartial,
    }
    return [entry]
  })

  // Real payout data ONLY. Drop the estimate fallback (payoutEstimated) and any
  // "awaiting" placeholder (awaitingSettlement) so a period appears here only
  // once the marketplace has published its real settlement for it — never a
  // percentage estimate, never a zero-filled row. The settled branch above is
  // the only one with payoutEstimated=false AND awaitingSettlement=false, so
  // only genuinely-settled periods survive.
  // (The P&L still surfaces these orders as revenue + a "pending" fee.)
  const realEntries = entries.filter(e => !e.payoutEstimated && !e.awaitingSettlement)
  // Latest activity on top — sort by the most recent order date in each period,
  // not just the YYYY-MM bucket, so within the same month a newer row sits
  // above an older one. Falls back to
  // firstOrderDate, then the period key. Dates are YYYY-MM-DD so lexical compare
  // is chronological.
  realEntries.sort((a, b) =>
    (b.lastOrderDate ?? b.firstOrderDate ?? '').localeCompare(a.lastOrderDate ?? a.firstOrderDate ?? '')
    || b.period.localeCompare(a.period))

  // Date-range filter: keep periods whose order span overlaps [from, to]. Dates
  // are YYYY-MM-DD so lexical compare is chronological; fall back to the period's
  // month boundaries when a bucket has no order dates.
  if (!range?.from && !range?.to) return realEntries
  const rFrom = range.from ?? '0000-01-01'
  const rTo = range.to ?? '9999-12-31'
  return realEntries.filter(e => {
    const eFrom = e.firstOrderDate ?? `${e.period}-01`
    const eTo = e.lastOrderDate ?? `${e.period}-31`
    return eTo >= rFrom && eFrom <= rTo
  })
}
