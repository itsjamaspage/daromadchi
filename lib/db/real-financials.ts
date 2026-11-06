import { inArray, gte, lte, and, sql, eq } from 'drizzle-orm'
import { db, shops, orders, uzumSettlementOrders } from '@/lib/db'
import type { MarketplaceType } from '@/lib/types'

/**
 * One source of truth for REAL per-bucket settlement financials. Reads
 * Uzum's finance/orders rows and aggregates them into a
 * {commission, delivery, net} shape keyed by bucket.
 *
 * Consumed by:
 *   - lib/db/pnl.ts    — override its estimated commission/delivery when
 *                        real settlement data exists for the bucket.
 *   - lib/db/kpis.ts   — override Dashboard's total_profit with real net.
 *   - lib/db/payouts.ts — the Payouts page's aggregator (which pioneered
 *                        this logic; keep its own inline copy for the
 *                        per-order-item breakdown, this helper is for the
 *                        summary buckets).
 *
 * Bucket format matches what the caller uses: 'YYYY-MM' for month, or
 * 'YYYY-MM-DD' for day.
 */
export interface RealBucket {
  commission: number
  delivery: number
  // Non-commission, non-delivery marketplace deductions — storage, acquiring,
  // ads/boost, loyalty, penalties, etc. Split out from `commission` so the
  // breakdown reconciles with the seller's finance report instead of hiding
  // these inside a catch-all.
  //
  // ALWAYS 0 TODAY, and deliberately kept: Uzum's finance feed has explicit
  // commission / delivery columns and no "other" category, so the only writer
  // this field ever had was the Yandex netting classifier, removed with that
  // integration. The P&L still renders the «Прочие» line from it, which reads
  // as "—" until a marketplace that reports such fees is added. Do not read a
  // 0 here as "no such fees were charged" — it means "not reported separately".
  other: number
  net: number
  itemCount: number   // >0 means real data is present; 0 → caller uses its own estimate
}

/**
 * Settlement financials, bucketed by day or month.
 *
 * `to` bounds the window on the RIGHT. It is optional because the per-bucket
 * callers (P&L, the diagnose route) read buckets back by key and so cannot pick
 * up a transaction outside their range — but a caller that SUMS the returned
 * buckets has no such protection, and an unbounded sum is then "from `from`
 * until forever". That is exactly what made the dashboard's Чистая прибыль
 * wrong: a week with no orders still showed a large profit, because the figure
 * was every settlement from that Monday onward minus the COGS of that one week.
 * Pass `to` whenever the result is going to be totalled.
 *
 * `attributeTo` picks the CLOCK:
 *   'payment' (default) — bucket by transaction_at, when the marketplace paid.
 *                         Right for a payout report.
 *   'order'             — bucket by the date of the order the row belongs to,
 *                         falling back to transaction_at for rows with no order
 *                         behind them (storage, acquiring, ads, penalties).
 *                         Right for anything compared against revenue or COGS,
 *                         which are bucketed by orders.ordered_at: mixing the
 *                         two clocks is what put a week's fees in a different
 *                         week from its sales. The fallback is deliberate —
 *                         overhead belongs to a payout period rather than to any
 *                         sale, and dropping it would quietly delete real costs.
 */
export async function getRealFinancialsByBucket(
  shopIds: string[],
  from: Date,
  bucket: 'day' | 'month',
  to?: Date | null,
  attributeTo: 'payment' | 'order' = 'payment',
): Promise<Map<string, RealBucket>> {
  const out = new Map<string, RealBucket>()
  if (shopIds.length === 0) return out

  const fmt = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'

  // Split shops by marketplace — settlement tables are per-marketplace,
  // and a mixed shopIds list wastes queries hitting both.
  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops).where(inArray(shops.id, shopIds))
  const uzShopIds = shopRows.filter(r => r.marketplace === 'uzum').map(r => r.id)

  const bump = (key: string, patch: Partial<RealBucket>) => {
    const cur = out.get(key) ?? { commission: 0, delivery: 0, other: 0, net: 0, itemCount: 0 }
    cur.commission  += patch.commission  ?? 0
    cur.delivery    += patch.delivery    ?? 0
    cur.other       += patch.other       ?? 0
    cur.net         += patch.net         ?? 0
    cur.itemCount   += patch.itemCount   ?? 0
    out.set(key, cur)
  }

  // ── Uzum: per-order-item rows with authoritative commission +
  //    delivery + net. Skip CANCELED items entirely (seller gets
  //    nothing, pays nothing).
  if (uzShopIds.length > 0) {
    try {
      const uzAt = attributeTo === 'order'
        ? sql`coalesce(${orders.ordered_at}, ${uzumSettlementOrders.transaction_at})`
        : sql`${uzumSettlementOrders.transaction_at}`
      const uzQuery = db.select({
        bucket:           sql<string>`to_char(${uzAt}, ${sql.raw(`'${fmt}'`)})`.as('bucket'),
        status:           uzumSettlementOrders.status,
        seller_price:     uzumSettlementOrders.seller_price,
        commission:       uzumSettlementOrders.commission,
        delivery:         uzumSettlementOrders.logistic_delivery_fee,
        withdrawn_profit: uzumSettlementOrders.withdrawn_profit,
        seller_profit:    uzumSettlementOrders.seller_profit,
      }).from(uzumSettlementOrders)
      if (attributeTo === 'order') {
        uzQuery.leftJoin(orders, and(
          eq(orders.shop_id, uzumSettlementOrders.shop_id),
          eq(orders.order_id_external, sql`${uzumSettlementOrders.uzum_order_id}::text`),
        ))
      }
      const rows = await uzQuery
        .where(and(
          inArray(uzumSettlementOrders.shop_id, uzShopIds),
          gte(uzAt, from),
          ...(to ? [lte(uzAt, to)] : []),
        ))
      for (const r of rows) {
        if (!r.bucket || r.status === 'CANCELED') continue
        const gross      = Number(r.seller_price ?? 0)
        const commission = Number(r.commission   ?? 0)
        const delivery   = Number(r.delivery     ?? 0)
        // Uzum populates withdrawn_profit and seller_profit with numeric
        // 0.00 (not null) on PROCESSING rows — money hasn't hit the
        // balance yet, so withdrawn=0, but seller_profit already carries
        // the expected net. Ranking "> 0" instead of "not null" so the
        // 0.00 doesn't win over the real 55550. Matches payouts.ts's
        // aggregate-level preference.
        const withdrawn = Number(r.withdrawn_profit ?? 0)
        const profit    = Number(r.seller_profit    ?? 0)
        const derived   = gross - commission - delivery
        const net = withdrawn > 0 ? withdrawn
                  : profit    > 0 ? profit
                  : derived
        bump(r.bucket, { commission, delivery, net, itemCount: 1 })
      }
    } catch (e) {
      console.error('[real-financials] uzum query failed:', String(e).slice(0, 200))
    }
  }

  return out
}

/**
 * Per-SKU real commission + delivery rates, derived from settlements.
 *
 * Consumed by lib/db/unit-economics.ts so the Unit Economics page can
 * show the seller's ACTUAL marketplace fees for each SKU they've
 * already sold, instead of a hard-coded "5% commission, 20% delivery"
 * default that's wrong for every marketplace.
 *
 */
export interface RealRateForSku {
  marketplace: MarketplaceType
  commissionPct: number   // real commission as % of seller_price
  deliveryPct: number     // real delivery as % of seller_price
  itemCount: number       // number of settled items backing this rate
  windowSince: string     // ISO date the rate was computed from
}

/**
 * Normalise a SKU for cross-source matching. Uzum stores compound
 * SKUs like "5124786-JMJ16BEG" (vendorId-yourSKU); the extension may
 * pass yet another variant.
 * We uppercase, strip whitespace and non-alphanumerics, and keep the
 * result. Matching then compares normalised forms and also allows
 * substring hits (either side contained in the other).
 */
function normSku(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function getRealRatesBySku(userId: string, windowDays = 60): Promise<Map<string, RealRateForSku>> {
  const out = new Map<string, RealRateForSku>()

  const since = new Date()
  since.setDate(since.getDate() - windowDays)
  const sinceIso = since.toISOString()

  const userShops = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops).where(and(eq(shops.user_id, userId), eq(shops.is_active, true)))
  const uzShopIds = userShops.filter(s => s.marketplace === 'uzum').map(s => s.id)

  // Uzum — per-item rows already carry sku_title + real seller_price +
  // commission + logistic_delivery_fee. Skip CANCELED (seller neither
  // received the money nor paid the fee).
  if (uzShopIds.length > 0) {
    try {
      const rows = await db.select({
        sku:          uzumSettlementOrders.sku_title,
        status:       uzumSettlementOrders.status,
        seller_price: uzumSettlementOrders.seller_price,
        commission:   uzumSettlementOrders.commission,
        delivery:     uzumSettlementOrders.logistic_delivery_fee,
      }).from(uzumSettlementOrders)
        .where(and(
          inArray(uzumSettlementOrders.shop_id, uzShopIds),
          gte(uzumSettlementOrders.transaction_at, since),
        ))
      const perSku = new Map<string, { gross: number; commission: number; delivery: number; itemCount: number }>()
      for (const r of rows) {
        if (r.status === 'CANCELED') continue
        const sku = (r.sku ?? '').trim()
        if (!sku) continue
        const b = perSku.get(sku) ?? { gross: 0, commission: 0, delivery: 0, itemCount: 0 }
        b.itemCount += 1
        b.gross      += Number(r.seller_price ?? 0)
        b.commission += Number(r.commission   ?? 0)
        b.delivery   += Number(r.delivery     ?? 0)
        perSku.set(sku, b)
      }
      for (const [sku, v] of perSku) {
        if (v.gross <= 0) continue
        const rate: RealRateForSku = {
          marketplace:  'uzum',
          commissionPct: (v.commission / v.gross) * 100,
          deliveryPct:   (v.delivery   / v.gross) * 100,
          itemCount:     v.itemCount,
          windowSince:   sinceIso,
        }
        out.set(sku, rate)
        // Uzum's sku_title often looks like "5124786-JMJ16BEG" —
        // register aliases so both "5124786-JMJ16BEG" and "JMJ16BEG"
        // (which is what the seller typically types into Unit
        // Economics or the extension passes as productId) hit the
        // same rate.
        const norm = normSku(sku)
        if (norm && norm !== sku) out.set(norm, rate)
        // Also register each dash-separated segment individually so
        // "5124786-JMJ16BEG" is findable via "JMJ16BEG" alone.
        for (const part of sku.split(/[-\s|/,]+/)) {
          const p = part.trim()
          if (p && p !== sku && !out.has(p)) out.set(p, rate)
          const pn = normSku(p)
          if (pn && pn !== p && !out.has(pn)) out.set(pn, rate)
        }
      }
    } catch (e) {
      console.error('[real-financials] uzum per-sku failed:', String(e).slice(0, 200))
    }
  }

  return out
}


/* ── Settlement money, attributed to the ORDER it belongs to ──────────────────
 *
 * getRealFinancialsByBucket above buckets by transaction_at — WHEN THE
 * MARKETPLACE PAID. That is the right clock for a payout report, and the wrong
 * one for "what did this week earn": revenue and COGS are bucketed by
 * orders.ordered_at, so subtracting one from the other mixes two calendars. A
 * week with no sales showed +73 000 of profit (payout money for older sales
 * landing that week, with no COGS to subtract) and a week with 200 000 of sales
 * showed −52 250 (its cost charged against settlements that had not arrived).
 *
 * The feed can say which order a row belongs to, so the money can follow the
 * sale instead of the payment:
 *   • uzum_settlement_orders.uzum_order_id
 *
 * Rows with NO order behind them — storage, acquiring, ads, penalties — do not
 * join and are deliberately absent here. They are real costs, but they belong to
 * a payout period rather than to any sale, and letting them through would put a
 * loss in a week that sold nothing: the same bug with a smaller number. They
 * stay visible on Payouts and in the P&L breakdown, which report by payout date.
 */

/** Settlement net per order, keyed by orders.id. Only orders in [from, to]. */
export async function getSettlementNetByOrder(
  shopIds: string[],
  from: Date | null,
  to: Date | null,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (shopIds.length === 0) return out

  const window = [
    inArray(orders.shop_id, shopIds),
    ...(from ? [gte(orders.ordered_at, from)] : []),
    ...(to ? [lte(orders.ordered_at, to)] : []),
  ]

  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops).where(inArray(shops.id, shopIds))
  const uzShopIds = shopRows.filter(r => r.marketplace === 'uzum').map(r => r.id)

  const bump = (orderId: string, amount: number): void => {
    out.set(orderId, (out.get(orderId) ?? 0) + amount)
  }

  // Uzum: one row per order ITEM, each already carrying its own net.
  if (uzShopIds.length > 0) {
    try {
      const rows = await db.select({
        order_id: orders.id,
        status: uzumSettlementOrders.status,
        seller_price: uzumSettlementOrders.seller_price,
        commission: uzumSettlementOrders.commission,
        delivery: uzumSettlementOrders.logistic_delivery_fee,
        withdrawn_profit: uzumSettlementOrders.withdrawn_profit,
        seller_profit: uzumSettlementOrders.seller_profit,
      }).from(uzumSettlementOrders)
        .innerJoin(orders, and(
          eq(orders.shop_id, uzumSettlementOrders.shop_id),
          eq(orders.order_id_external, sql`${uzumSettlementOrders.uzum_order_id}::text`),
        ))
        .where(and(inArray(uzumSettlementOrders.shop_id, uzShopIds), ...window))
      for (const r of rows) {
        if (r.status === 'CANCELED') continue   // nothing earned, nothing charged
        const withdrawn = Number(r.withdrawn_profit ?? 0)
        const profit    = Number(r.seller_profit    ?? 0)
        const derived   = Number(r.seller_price ?? 0) - Number(r.commission ?? 0) - Number(r.delivery ?? 0)
        bump(r.order_id as string, withdrawn > 0 ? withdrawn : profit > 0 ? profit : derived)
      }
    } catch (e) {
      console.error('[real-financials] uzum by-order query failed:', String(e).slice(0, 200))
    }
  }

  return out
}
