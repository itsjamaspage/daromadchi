import { inArray, gte, and, asc, ne, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products, shops, uzumSettlementOrders, yandexSettlementTransactions } from '@/lib/db'
import { getShopIds } from '@/lib/db/shop-context'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import { getRealFinancialsByBucket } from '@/lib/db/real-financials'
import type { MarketplaceType } from '@/lib/types'

/**
 * Daily P&L with a full expense breakdown. Marketplaces rarely report fees
 * per order (Uzum's seller API doesn't), so where real numbers are missing the
 * expense lines are ESTIMATED from the user's Unit Economics parameters
 * (commission %, acquiring %, tax %, ad %, last-mile %) — the same numbers
 * they already maintain on the Unit Economics page. COGS comes from each
 * product's cost price × units sold. Cancelled orders are excluded from every
 * money figure but shown as a count so a cancellation-only day still renders.
 */
export interface PnlRow {
  /** YYYY-MM or YYYY-MM-DD depending on bucket — the page formats it in-locale */
  bucketKey: string
  /** kept for backward compatibility with legacy callers */
  monthKey: string
  month: string
  order_count: number
  cancelled_count: number
  cancelled_amount: number
  revenue: number
  commission: number
  delivery: number
  acquiring: number
  tax: number
  cogs: number
  net: number
  penalty: number
  storageFee: number
  additionalPayment: number
  /** true when commission/delivery came from percentages, not marketplace data */
  estimated: boolean
  /**
   * true when the bucket has a Yandex sale whose real settlement hasn't landed
   * yet. Yandex fees are NEVER estimated from a percentage (the order endpoint
   * carries no real fee — only the netting report does, a few days later), so
   * the UI shows "pending" for these instead of a fabricated number.
   */
  feePending: boolean
}

// Alias for callers that were reading MonthlyPnl by name.
export type MonthlyPnl = PnlRow

export interface PnlParams {
  commissionPct: number
  acquiringPct: number
  taxPct: number
  lastMilePct: number
}

export interface PnlOpts {
  from: Date
  to: Date
  bucket: 'day' | 'month'
  marketplace?: MarketplaceType
}

/**
 * P&L for an arbitrary date range and bucket granularity.
 * - bucket='day'  → one row per YYYY-MM-DD (used for short ranges like "today" or "7 days")
 * - bucket='month' → one row per YYYY-MM (used for long ranges like "1 year")
 * COGS and ad-spend are aggregated at the same granularity so the estimated
 * lines stay proportional to the row they belong to instead of leaking across
 * months when a range spans a month boundary.
 */
export async function getPnl(opts: PnlOpts): Promise<{ rows: PnlRow[]; params: PnlParams }> {
  const { from, to, bucket, marketplace } = opts
  const ue = await getUnitEcoSettings()
  const params: PnlParams = {
    commissionPct: ue.defaultCommissionPct,
    acquiringPct: ue.acquiringPct,
    taxPct: ue.taxPct,
    lastMilePct: ue.lastMilePct,
  }

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return { rows: [], params }

  const fmt = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'
  const orderBucketSql   = sql<string>`to_char(${orders.ordered_at}, ${sql.raw(`'${fmt}'`)})`

  const [rows, cogsRows] = await Promise.all([
    db.select({
      ordered_at: orders.ordered_at,
      status: orders.status,
      marketplace: orders.marketplace,
      revenue: orders.revenue,
      marketplace_fee: orders.marketplace_fee,
      delivery_cost: orders.delivery_cost,
      penalty: orders.penalty,
      storage_fee: orders.storage_fee,
      additional_payment: orders.additional_payment,
    }).from(orders)
      .where(and(
        inArray(orders.shop_id, shopIds),
        gte(orders.ordered_at, from),
        sql`${orders.ordered_at} <= ${to}`,
      ))
      .orderBy(asc(orders.ordered_at)),
    db.select({
      bucket: orderBucketSql.as('bucket'),
      cogs:   sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.cost_price}, 0)), 0)`.as('cogs'),
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .leftJoin(products, eq(orderItems.product_id, products.id))
      .where(and(
        inArray(orders.shop_id, shopIds),
        gte(orders.ordered_at, from),
        sql`${orders.ordered_at} <= ${to}`,
        ne(orders.status, 'cancelled'),
        ne(orders.status, 'returned'),
      ))
      .groupBy(orderBucketSql),
  ])

  const cogsByBucket = new Map(cogsRows.map(r => [r.bucket, Number(r.cogs)]))
  // Real per-bucket settlement financials. When present for a bucket
  // they REPLACE the Unit-Economics estimates for that bucket, so
  // Dashboard / P&L / Payouts all show identical numbers.
  const realByBucket = await getRealFinancialsByBucket(shopIds, from, bucket)

  // Zero-fill every DAY bucket in the range so an empty day renders a
  // "0" bar on the chart. Month buckets are NOT zero-filled — an empty
  // month is just noise in the table (5 rows of zeros before the first
  // month with orders is what the seller complained about) and the
  // chart handles missing months by simply omitting the bar.
  const grouped = new Map<string, {
    revenue: number; realFee: number; realDelivery: number; count: number
    // revenueEstimable = non-cancelled revenue EXCLUDING Yandex. Percentage
    // estimates for missing fees are applied ONLY to this, so Yandex revenue
    // is never multiplied into a fabricated fee. hasYandex flags a Yandex sale
    // in the bucket so we can mark its fee "pending" until settlement lands.
    revenueEstimable: number; hasYandex: boolean
    cancelledCount: number; cancelledAmount: number
    penalty: number; storageFee: number; additionalPayment: number
  }>()
  // Only days that actually have an order (or cancellation) get a row — the loop
  // below creates a bucket per order date. We deliberately DON'T pre-fill every
  // day in the range with a zero row: sellers asked to see only the dates when
  // something sold, not a wall of "0 so'm" days padding out the chart and table.
  for (const row of rows) {
    const d = row.ordered_at
    const key = bucket === 'day'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const ex = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0, count: 0, revenueEstimable: 0, hasYandex: false,
      cancelledCount: 0, cancelledAmount: 0,
      penalty: 0, storageFee: 0, additionalPayment: 0,
    }
    if (row.status === 'cancelled' || row.status === 'returned') {
      ex.cancelledCount += 1
      ex.cancelledAmount += Number(row.revenue ?? 0)
    } else {
      const rev = Number(row.revenue ?? 0)
      ex.revenue      += rev
      ex.realFee      += Number(row.marketplace_fee ?? 0)
      ex.realDelivery += Number(row.delivery_cost ?? 0)
      ex.penalty      += Number(row.penalty ?? 0)
      ex.storageFee   += Number(row.storage_fee ?? 0)
      ex.additionalPayment += Number(row.additional_payment ?? 0)
      ex.count        += 1
      // Yandex fees are settlement-only — never estimate them. Keep Yandex
      // revenue out of the estimable base and flag the sale as pending.
      if (row.marketplace === 'yandex_market') ex.hasYandex = true
      else ex.revenueEstimable += rev
    }
    grouped.set(key, ex)
  }

  const result: PnlRow[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      // Prefer real settlement data (Yandex united-netting or Uzum
      // /v1/finance/orders) when we have any for the bucket; fall back
      // to marketplace_fee stored on the orders row; fall back again
      // to Unit-Economics percentages. Same precedence Payouts uses.
      const real = realByBucket.get(key)
      const hasReal = !!real && real.itemCount > 0
      const hasRealYandex = !!real && real.ymItemCount > 0
      // Percentage estimates apply ONLY to estimable (non-Yandex) revenue —
      // Yandex fees are settlement-only and are never fabricated from a %.
      const estimated  = !hasReal && v.realFee === 0 && v.revenueEstimable > 0
      const commission = hasReal ? real!.commission
                       : estimated ? v.revenueEstimable * params.commissionPct / 100
                       : v.realFee
      const delivery   = hasReal ? real!.delivery
                       : v.realDelivery > 0 ? v.realDelivery
                       : v.revenueEstimable * params.lastMilePct / 100
      // Acquiring is bundled into marketplace commission (Uzum + Yandex
      // both fold it in). Only show a separate estimated acquiring line
      // when we're falling back to Unit-Economics percentages.
      const acquiring  = (!hasReal && estimated) ? v.revenueEstimable * params.acquiringPct / 100 : 0
      // A Yandex sale whose real settlement hasn't landed yet → its fee is
      // "pending" (shown as a placeholder), not zero and not an estimate.
      const feePending = v.hasYandex && !hasRealYandex
      const cogs       = cogsByBucket.get(key) ?? 0
      const penalty    = v.penalty
      const storageFee = v.storageFee
      const additionalPayment = v.additionalPayment
      // Tax: dropped from the automatic P&L calculation. Uzbek sellers'
      // tax rate depends on their legal form and turnover — we can't
      // know it from any marketplace API — so estimating from a
      // hard-coded percentage was misleading. Left at 0 here; a future
      // Settings toggle can add seller-configured tax back in.
      const tax        = 0
      return {
        bucketKey:        key,
        monthKey:         key,
        month:            key, // raw — the page formats via toLocaleDateString
        order_count:      v.count,
        cancelled_count:  v.cancelledCount,
        cancelled_amount: v.cancelledAmount,
        revenue:          v.revenue,
        commission,
        delivery,
        acquiring,
        tax,
        cogs,
        penalty,
        storageFee,
        additionalPayment,
        net: v.revenue - commission - delivery - acquiring - tax - cogs - penalty - storageFee - additionalPayment,
        estimated,
        feePending,
      }
    })

  return { rows: result, params }
}

/** One row per product sold in the range — backs the P&L "Себестоимость"
 *  card's inline cost editor. COGS = Σ(qty × cost_price), so the only
 *  coherent way to change it is per-product cost. Cancelled/returned are
 *  excluded (they don't contribute to COGS), matching getPnl's cogs query. */
export interface CogsProduct {
  productId: string
  title: string | null
  sku: string | null
  qty: number
  costPrice: number | null
}

export async function getCogsBreakdown(opts: {
  from: Date; to: Date; marketplace?: MarketplaceType
}): Promise<CogsProduct[]> {
  const shopIds = await getShopIds(opts.marketplace)
  if (!shopIds || shopIds.length === 0) return []
  const rows = await db.select({
    productId: orderItems.product_id,
    title:     products.title,
    sku:       products.sku,
    qty:       sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as('qty'),
    costPrice: products.cost_price,
  }).from(orderItems)
    .innerJoin(orders, eq(orderItems.order_id, orders.id))
    .innerJoin(products, eq(orderItems.product_id, products.id))
    .where(and(
      inArray(orders.shop_id, shopIds),
      gte(orders.ordered_at, opts.from),
      sql`${orders.ordered_at} <= ${opts.to}`,
      ne(orders.status, 'cancelled'),
      ne(orders.status, 'returned'),
    ))
    .groupBy(orderItems.product_id, products.title, products.sku, products.cost_price)
  return rows
    .filter((r): r is typeof r & { productId: string } => r.productId != null)
    .map(r => ({
      productId: r.productId,
      title:     r.title,
      sku:       r.sku,
      qty:       Number(r.qty),
      costPrice: r.costPrice != null ? Number(r.costPrice) : null,
    }))
    .sort((a, b) => b.qty - a.qty)
}

/** Delivery (logistics) charged per marketplace over the range, from the same
 *  settlement sources the P&L delivery figure uses — Uzum logistic_delivery_fee
 *  and Yandex "Доставка"-tagged debits. Backs the Доставка card tooltip so it
 *  can name which store charged the fee. Only non-zero stores matter to the UI. */
export interface DeliveryByMp { marketplace: 'uzum' | 'yandex_market'; delivery: number }

export async function getDeliveryByMarketplace(opts: {
  from: Date; to: Date; marketplace?: MarketplaceType
}): Promise<DeliveryByMp[]> {
  const shopIds = await getShopIds(opts.marketplace)
  if (!shopIds || shopIds.length === 0) return []
  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops).where(inArray(shops.id, shopIds))
  const uz = shopRows.filter(r => r.marketplace === 'uzum').map(r => r.id)
  const ym = shopRows.filter(r => r.marketplace === 'yandex_market').map(r => r.id)

  const out: DeliveryByMp[] = []
  if (uz.length > 0) {
    const [r] = await db.select({
      d: sql<number>`coalesce(sum(${uzumSettlementOrders.logistic_delivery_fee}), 0)`,
    }).from(uzumSettlementOrders).where(and(
      inArray(uzumSettlementOrders.shop_id, uz),
      gte(uzumSettlementOrders.transaction_at, opts.from),
      sql`${uzumSettlementOrders.transaction_at} <= ${opts.to}`,
      ne(uzumSettlementOrders.status, 'CANCELED'),
    ))
    out.push({ marketplace: 'uzum', delivery: Number(r?.d ?? 0) })
  }
  if (ym.length > 0) {
    const [r] = await db.select({
      d: sql<number>`coalesce(sum(${yandexSettlementTransactions.amount}), 0)`,
    }).from(yandexSettlementTransactions).where(and(
      inArray(yandexSettlementTransactions.shop_id, ym),
      gte(yandexSettlementTransactions.transaction_at, opts.from),
      sql`${yandexSettlementTransactions.transaction_at} <= ${opts.to}`,
      eq(yandexSettlementTransactions.entry_type, 'Удержание'),
      sql`${yandexSettlementTransactions.order_type} like '%Доставка%'`,
    ))
    out.push({ marketplace: 'yandex_market', delivery: Number(r?.d ?? 0) })
  }
  return out
}

/** @deprecated use getPnl instead */
export async function getMonthlyPnl(months = 6, marketplace?: MarketplaceType) {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - months)
  return getPnl({ from, to, bucket: 'month', marketplace })
}
