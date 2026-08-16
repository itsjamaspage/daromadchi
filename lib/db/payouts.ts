import { inArray, gte, and, ne, eq, sql, asc } from 'drizzle-orm'
import { db, orders, orderItems, products, shops, yandexSettlementTransactions, uzumSettlementOrders } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import type { PayoutEntry, PayoutOrderItem } from '@/lib/types'
import { deriveUzumBucketStatus, deriveYandexSettledStatus, isYandexTransferred, isYandexAwaitingTransfer } from '@/lib/db/payout-status'

export type { PayoutEntry }

export async function getPayoutEntries(range?: { from?: string; to?: string }): Promise<PayoutEntry[]> {
  const ue = await getUnitEcoSettings()
  const allShopIds = await getShopIds()
  if (!allShopIds || allShopIds.length === 0) return []

  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops)
    .where(inArray(shops.id, allShopIds))
  const mpByShop = new Map(shopRows.map(r => [r.id, r.marketplace]))

  const since = new Date()
  since.setMonth(since.getMonth() - 12)
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
      month: sql<string>`to_char(${orders.ordered_at}, 'YYYY-MM')`.as('month'),
      marketplace: orders.marketplace,
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`.as('cogs'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(
        inArray(orders.shop_id, allShopIds),
        gte(orders.ordered_at, since),
        ne(orders.status, 'cancelled'),
        ne(orders.status, 'returned'),
      ))
      .groupBy(sql`to_char(${orders.ordered_at}, 'YYYY-MM')`, orders.marketplace),
    // Per-product breakdown per period+marketplace. Aggregated in SQL so
    // 100 orders of the same SKU collapse to one row before it ever hits
    // the Node side. Cancelled/returned excluded — those already show in
    // the top-level "returns" column and would double-count here.
    db.select({
      month: sql<string>`to_char(${orders.ordered_at}, 'YYYY-MM')`.as('month'),
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
        sql`to_char(${orders.ordered_at}, 'YYYY-MM')`,
        orders.marketplace,
        orderItems.product_id,
        products.title,
        products.sku,
      ),
  ])

  if (orderRows.length === 0) return []

  const cogsMap = new Map(cogsRows.map(r => [`${r.month}|${r.marketplace}`, Number(r.cogs)]))

  const itemsMap = new Map<string, PayoutOrderItem[]>()
  for (const r of itemRows) {
    const key = `${r.month}|${r.marketplace}`
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
    count: number; returnCount: number; returnAmount: number
    // Actual min/max ordered_at across NON-CANCELLED orders in this
    // bucket. Cancelled/returned orders are excluded so an empty payout
    // period doesn't get a range from its refunded orders.
    firstOrderAt: Date | null; lastOrderAt: Date | null
    // Marketplace order numbers (orders.order_id_external) contributing to this
    // payout period — so a row can be cross-referenced with the seller cabinet.
    orderNumbers: string[]
  }
  const grouped = new Map<string, Bucket>()

  for (const row of orderRows) {
    // Cancelled orders NEVER enter the payout pipeline — the buyer's
    // money was refunded before the marketplace paid the seller, so
    // they don't affect what gets deposited. Skip entirely (was
    // previously counted as "Возвраты" which read as a payout
    // deduction, but there's nothing to deduct because the money was
    // never transferred). Only true returns — customer received the
    // product and returned it — actually claw money back from a prior
    // payout, and stay in returnAmount.
    if (row.status === 'cancelled') continue

    const d = row.ordered_at
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mp = mpByShop.get(row.shop_id) ?? 'uzum'
    const key = `${monthKey}|${mp}`
    const b = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0,
      penalty: 0, storageFee: 0, additionalPayment: 0,
      count: 0, returnCount: 0, returnAmount: 0,
      firstOrderAt: null, lastOrderAt: null,
      orderNumbers: [],
    }

    if (row.status === 'returned') {
      b.returnCount += 1
      b.returnAmount += Number(row.revenue ?? 0)
    } else {
      b.revenue += Number(row.revenue ?? 0)
      b.realFee += Number(row.marketplace_fee ?? 0)
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
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Yandex real-settlement aggregation. Per YYYY-MM bucket, sum:
  //   - Начисления (positive contribution to what seller receives)
  //   - Удержания (negative contribution)
  // Grouped by (shop_id, YYYY-MM) so we can match the |mp key below.
  const ymShopIds = shopRows.filter(r => r.marketplace === 'yandex_market').map(r => r.id)
  const ymSettlementByKey = new Map<string, { credit: number; debit: number; commission: number; delivery: number; other: number; txnCount: number; transferred: number; awaiting: number; paymentOrders: Set<string> }>()
  if (ymShopIds.length > 0) {
    // Try/catch guards against the migration not yet being applied on
    // this DB (fresh deploy race, or admin manually rolled back). The
    // Payouts page must render even if the settlements table doesn't
    // exist yet — every Yandex row just stays in "awaiting" state.
    try {
      const settlementRows = await db.select({
        month:  sql<string>`to_char(${yandexSettlementTransactions.transaction_at}, 'YYYY-MM')`.as('month'),
        entry_type: yandexSettlementTransactions.entry_type,
        entry_source: yandexSettlementTransactions.entry_source,
        order_type: yandexSettlementTransactions.order_type,
        amount: yandexSettlementTransactions.amount,
        status_note: yandexSettlementTransactions.status_note,
        payment_order_number: yandexSettlementTransactions.payment_order_number,
      }).from(yandexSettlementTransactions)
        .where(and(
          inArray(yandexSettlementTransactions.shop_id, ymShopIds),
          gte(yandexSettlementTransactions.transaction_at, since),
        ))
      for (const r of settlementRows) {
        if (!r.month) continue
        const key = `${r.month}|yandex_market`
        const b = ymSettlementByKey.get(key) ?? { credit: 0, debit: 0, commission: 0, delivery: 0, other: 0, txnCount: 0, transferred: 0, awaiting: 0, paymentOrders: new Set<string>() }
        const amt = Number(r.amount)
        b.txnCount += 1
        // Transfer roll-up (PROBLEM 1): count transactions the netting report says
        // are transferred («Переведён…» + payment-order number) vs still awaiting
        // («Будет переведён…»). A bucket is "paid" only when it has a transfer and
        // nothing still awaiting — see deriveYandexSettledStatus(transferPosted).
        if (isYandexTransferred(r.status_note, r.payment_order_number)) {
          b.transferred += 1
          // The payment-order number (№ платежного поручения, e.g. 92735) is the
          // bank-statement reference for this payout — collect it for the paid row.
          if (r.payment_order_number) b.paymentOrders.add(String(r.payment_order_number).trim())
        } else if (isYandexAwaitingTransfer(r.status_note)) b.awaiting += 1
        if (r.entry_type === 'Начисление') {
          b.credit += amt
        } else {
          b.debit += amt
          // Split debits by orderType so the UI can show delivery vs commission
          // separately. "Доставка покупателю" is delivery, everything else is
          // rolled into commission (which for Yandex Uzbekistan includes their
          // bundled "Услуги маркета" — commission + acquiring + ads).
          if ((r.order_type ?? '').includes('Доставка')) b.delivery += amt
          else if ((r.order_type ?? '').includes('Поручение')) b.commission += amt
          else b.other += amt
        }
        ymSettlementByKey.set(key, b)
      }
    } catch (e) {
      // Table missing or query failed. Log for diagnosis; render with
      // no settlement rows (Yandex rows stay in "awaiting" state).
      console.error('[payouts] yandex_settlement_transactions query failed:', String(e).slice(0, 200))
    }
  }

  // Uzum real-settlement aggregation — mirror the Yandex approach.
  // /v1/finance/orders returns per-order-item rows with authoritative
  // sellerPrice / commission / logisticDeliveryFee / withdrawnProfit,
  // so we sum by (shop_id × YYYY-MM) and use those instead of the
  // Unit-Economics-percentage estimate.
  const uzShopIds = shopRows.filter(r => r.marketplace === 'uzum').map(r => r.id)
  const uzSettlementByKey = new Map<string, { gross: number; commission: number; delivery: number; net: number; profitFallback: number; itemCount: number; statuses: Set<string> }>()
  if (uzShopIds.length > 0) {
    try {
      const settlementRows = await db.select({
        month:            sql<string>`to_char(${uzumSettlementOrders.transaction_at}, 'YYYY-MM')`.as('month'),
        status:           uzumSettlementOrders.status,
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
        if (!r.month) continue
        // Skip cancelled — Uzum sends them with sellerPrice > 0 too, and
        // we already show cancellations in the returns column.
        if (r.status === 'CANCELED') continue
        const key = `${r.month}|uzum`
        const b = uzSettlementByKey.get(key) ?? { gross: 0, commission: 0, delivery: 0, net: 0, profitFallback: 0, itemCount: 0, statuses: new Set<string>() }
        b.itemCount += 1
        // Track the per-order finance/orders status so the bucket status is
        // rolled up from real signals (TO_WITHDRAW vs PROCESSING), never the
        // calendar. CANCELED is already skipped above.
        if (r.status) b.statuses.add(r.status)
        b.gross      += Number(r.seller_price ?? 0)
        b.commission += Number(r.commission   ?? 0)
        b.delivery   += Number(r.delivery     ?? 0)
        // Prefer withdrawnProfit (what actually hit the seller's balance)
        // and fall back to sellerProfit (pre-withdrawal profit) if the
        // former is still null for a fresh row.
        const withdrawn = r.withdrawn_profit != null ? Number(r.withdrawn_profit) : null
        const profit    = r.seller_profit    != null ? Number(r.seller_profit)    : null
        if (withdrawn != null) b.net += withdrawn
        if (profit    != null) b.profitFallback += profit
        uzSettlementByKey.set(key, b)
      }
    } catch (e) {
      console.error('[payouts] uzum_settlement_orders query failed:', String(e).slice(0, 200))
    }
  }

  const entries: PayoutEntry[] = Array.from(grouped.entries()).flatMap(([key, v]) => {
    const [monthKey, mp] = key.split('|')

    // Yandex Market special-case: the `commissionTotal` field on the
    // /v2/campaigns/{id}/orders endpoint is Yandex's order-TIME
    // estimate, not the actual settlement charge. The real numbers
    // live in Yandex's "united netting report" which is generated
    // async and typically published a few days AFTER settlement.
    //
    // Seller explicitly asked: for Yandex, DON'T estimate. Wait until
    // Yandex publishes real settlement data, then show that. Until
    // then we return a placeholder entry with status='pending_settlement'
    // and net=null so the UI can render "Ожидает данных Yandex"
    // instead of guessing.
    //
    // TODO: fetch Yandex united-netting-report API and store real
    // settlement per order — then this branch flips to real numbers.
    if (mp === 'yandex_market') {
      const isPast = monthKey < currentMonth
      const settled = ymSettlementByKey.get(key)
      // If Yandex has already published settlement data for this month,
      // use its REAL numbers. Otherwise return an "awaiting" placeholder.
      if (settled && settled.txnCount > 0) {
        const netPayout = settled.credit - settled.debit
        const entry: PayoutEntry = {
          id: key,
          period: monthKey,
          marketplace: mp,
          grossRevenue: settled.credit || v.revenue,
          commission: settled.commission + settled.other, // "Услуги маркета" bundles commission + ads + acquiring
          delivery: settled.delivery,
          returns: v.returnAmount,
          adSpend: 0,
          acquiring: 0,
          tax: 0,
          penalty: 0,
          storageFee: 0,
          additionalPayment: 0,
          otherDeductions: 0,
          netPayout,
          ordersCount: v.count,
          orderNumbers: v.orderNumbers,
          paymentReferences: [...settled.paymentOrders],
          // Status from the netting report, never the calendar:
          //  • transferPosted (a payment order issued, none still awaiting) → paid
          //  • credit>0 & debit==0 (fees not posted yet) → fees_pending (visible at gross)
          //  • else → pending
          // transferPosted = the bucket has a transferred txn and none still awaiting.
          status: deriveYandexSettledStatus(
            settled.credit,
            settled.debit,
            settled.transferred > 0 && settled.awaiting === 0,
          ),
          payoutDate: null,
          payoutEstimated: false,
          items: itemsMap.get(key) ?? [],
          firstOrderDate: isoDate(v.firstOrderAt),
          lastOrderDate:  isoDate(v.lastOrderAt),
          awaitingSettlement: false,
        }
        return [entry]
      }

      const entry: PayoutEntry = {
        id: key,
        period: monthKey,
        marketplace: mp,
        grossRevenue: v.revenue,
        commission: 0,
        delivery: 0,
        returns: v.returnAmount,
        adSpend: 0,
        acquiring: 0,
        tax: 0,
        penalty: 0,
        storageFee: 0,
        additionalPayment: 0,
        otherDeductions: 0,
        netPayout: 0,
        ordersCount: v.count,
        orderNumbers: v.orderNumbers,
        status: isPast ? 'pending' : 'estimated_pending',
        payoutDate: null,
        payoutEstimated: false,
        items: itemsMap.get(key) ?? [],
        firstOrderDate: isoDate(v.firstOrderAt),
        lastOrderDate:  isoDate(v.lastOrderAt),
        awaitingSettlement: true,
      }
      return [entry]
    }

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
        const entry: PayoutEntry = {
          id: key,
          period: monthKey,
          marketplace: mp,
          grossRevenue: settled.gross || v.revenue,
          commission: settled.commission,
          delivery: settled.delivery,
          returns: v.returnAmount,
          adSpend: 0,
          acquiring: 0,
          tax: 0,
          penalty: v.penalty,
          storageFee: v.storageFee,
          additionalPayment: v.additionalPayment,
          otherDeductions: 0,
          netPayout: net,
          ordersCount: v.count,
          orderNumbers: v.orderNumbers,
          // Status from REAL Uzum order signals, never the calendar: any
          // TO_WITHDRAW → available_to_withdraw (earned, not withdrawn), else
          // pending. Never 'paid' — no accessible completed-withdrawal feed.
          status: deriveUzumBucketStatus([...settled.statuses]),
          payoutDate: null,
          payoutEstimated: false,
          items: itemsMap.get(key) ?? [],
          firstOrderDate: isoDate(v.firstOrderAt),
          lastOrderDate:  isoDate(v.lastOrderAt),
          awaitingSettlement: false,
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

    const isPast = monthKey < currentMonth
    const entry: PayoutEntry = {
      id: key,
      period: monthKey,
      marketplace: mp,
      grossRevenue: v.revenue,
      commission,
      delivery,
      returns: v.returnAmount,
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
      // TODO: replace with real payout schedule data from each marketplace's API
      status: isPast ? 'estimated_paid' : 'estimated_pending',
      payoutDate: null,
      payoutEstimated: true,
      items: itemsMap.get(key) ?? [],
      firstOrderDate: isoDate(v.firstOrderAt),
      lastOrderDate:  isoDate(v.lastOrderAt),
      awaitingSettlement: false,
    }
    return [entry]
  })

  // Real payout data ONLY. Drop the estimate fallback (payoutEstimated) and
  // the Yandex "awaiting" placeholder (awaitingSettlement) so a period appears
  // here only once the marketplace has published its real settlement/netting
  // for it — never a percentage estimate, never a zero-filled row. The two
  // settled branches above are the only ones with payoutEstimated=false AND
  // awaitingSettlement=false, so only genuinely-settled periods survive.
  // (The P&L still surfaces these orders as revenue + a "pending" fee.)
  const realEntries = entries.filter(e => !e.payoutEstimated && !e.awaitingSettlement)
  // Latest activity on top — sort by the most recent order date in each period,
  // not just the YYYY-MM bucket, so within the same month a newer row (e.g. a
  // 10 Aug Yandex period) sits above an older one (7 Aug Uzum). Falls back to
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
