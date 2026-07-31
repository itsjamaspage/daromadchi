import { inArray, gte, and, asc, ne, eq, sql } from 'drizzle-orm'
import { db, orders, orderItems, products, productAdsStats } from '@/lib/db'
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
  ads: number
  cogs: number
  net: number
  penalty: number
  storageFee: number
  additionalPayment: number
  /** true when commission/delivery came from percentages, not marketplace data */
  estimated: boolean
  adSpendEstimated: boolean
}

// Alias for callers that were reading MonthlyPnl by name.
export type MonthlyPnl = PnlRow

export interface PnlParams {
  commissionPct: number
  acquiringPct: number
  taxPct: number
  adPct: number
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
    adPct: ue.adPct,
    lastMilePct: ue.lastMilePct,
  }

  const shopIds = await getShopIds(marketplace)
  if (!shopIds || shopIds.length === 0) return { rows: [], params }

  const fromStr = from.toISOString().slice(0, 10)
  const fmt = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'
  const orderBucketSql   = sql<string>`to_char(${orders.ordered_at}, ${sql.raw(`'${fmt}'`)})`
  const adBucketSql      = sql<string>`to_char(${productAdsStats.date}::date, ${sql.raw(`'${fmt}'`)})`

  const [rows, cogsRows, adSpendRows] = await Promise.all([
    db.select({
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
    db.select({
      bucket: adBucketSql.as('bucket'),
      spend:  sql<number>`coalesce(sum(${productAdsStats.spend}), 0)`.as('spend'),
    }).from(productAdsStats)
      .where(and(
        inArray(productAdsStats.shop_id, shopIds),
        gte(productAdsStats.date, fromStr),
        sql`${productAdsStats.date} <= ${to.toISOString().slice(0, 10)}`,
      ))
      .groupBy(adBucketSql),
  ])

  const cogsByBucket = new Map(cogsRows.map(r => [r.bucket, Number(r.cogs)]))
  const adSpendByBucket = new Map(adSpendRows.map(r => [r.bucket, Number(r.spend)]))
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
    cancelledCount: number; cancelledAmount: number
    penalty: number; storageFee: number; additionalPayment: number
  }>()
  if (bucket === 'day') {
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const stop   = new Date(to.getFullYear(), to.getMonth(), to.getDate())
    while (cursor <= stop) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      grouped.set(key, {
        revenue: 0, realFee: 0, realDelivery: 0, count: 0, cancelledCount: 0, cancelledAmount: 0,
        penalty: 0, storageFee: 0, additionalPayment: 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  for (const row of rows) {
    const d = row.ordered_at
    const key = bucket === 'day'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const ex = grouped.get(key) ?? {
      revenue: 0, realFee: 0, realDelivery: 0, count: 0, cancelledCount: 0, cancelledAmount: 0,
      penalty: 0, storageFee: 0, additionalPayment: 0,
    }
    if (row.status === 'cancelled' || row.status === 'returned') {
      ex.cancelledCount += 1
      ex.cancelledAmount += Number(row.revenue ?? 0)
    } else {
      ex.revenue      += Number(row.revenue ?? 0)
      ex.realFee      += Number(row.marketplace_fee ?? 0)
      ex.realDelivery += Number(row.delivery_cost ?? 0)
      ex.penalty      += Number(row.penalty ?? 0)
      ex.storageFee   += Number(row.storage_fee ?? 0)
      ex.additionalPayment += Number(row.additional_payment ?? 0)
      ex.count        += 1
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
      const estimated  = !hasReal && v.realFee === 0 && v.revenue > 0
      const commission = hasReal ? real!.commission
                       : estimated ? v.revenue * params.commissionPct / 100
                       : v.realFee
      const delivery   = hasReal ? real!.delivery
                       : v.realDelivery > 0 ? v.realDelivery
                       : v.revenue * params.lastMilePct / 100
      // Acquiring is bundled into marketplace commission (Uzum + Yandex
      // both fold it in). Only show a separate estimated acquiring line
      // when we're falling back to Unit-Economics percentages.
      const acquiring  = (!hasReal && estimated) ? v.revenue * params.acquiringPct / 100 : 0
      // Ads: use ONLY real productAdsStats data. Sellers explicitly
      // asked to drop the "estimate from % of revenue" fallback — that
      // was producing phantom ad-spend lines for shops that never ran
      // ads. If we have no real data, show 0, not an estimate.
      const realAdSpend = adSpendByBucket.get(key) ?? 0
      const ads = realAdSpend
      const adSpendEstimated = false
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
        ads,
        cogs,
        penalty,
        storageFee,
        additionalPayment,
        net: v.revenue - commission - delivery - acquiring - tax - ads - cogs - penalty - storageFee - additionalPayment,
        estimated,
        adSpendEstimated,
      }
    })

  return { rows: result, params }
}

/** @deprecated use getPnl instead */
export async function getMonthlyPnl(months = 6, marketplace?: MarketplaceType) {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - months)
  return getPnl({ from, to, bucket: 'month', marketplace })
}
