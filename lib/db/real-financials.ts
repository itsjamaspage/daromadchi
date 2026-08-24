import { inArray, gte, and, sql, eq } from 'drizzle-orm'
import { db, shops, yandexSettlementTransactions, uzumSettlementOrders } from '@/lib/db'
import type { MarketplaceType } from '@/lib/types'

/**
 * One source of truth for REAL per-bucket settlement financials. Reads
 * Yandex's united-netting rows and Uzum's finance/orders rows, aggregates
 * both into the same {commission, delivery, net} shape keyed by bucket.
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
/**
 * Classify a Yandex united-netting DEBIT (Удержание) row into commission /
 * delivery / other, keyed off `product_name` — the «…услуги (к удержанию)»
 * column that names the service. (order_type is NOT it — it's always "Продажа
 * физлицу".) Only two names are real revenue-share buckets:
 *   "Доставка покупателю"  → delivery
 *   "Поручение на продажу" → commission (the sales commission)
 * Everything else is a genuine "other" fee — a late-shipment penalty
 * ("Отгрузка или доставка не вовремя"), a transfer fee ("Поручение на перевод
 * платежа"), storage, acquiring, ads, loyalty — OR a blank/unnamed row we can't
 * attribute (older rows synced before product_name was captured; a settlements
 * re-sync backfills the name via the upsert). Exact match on purpose: the penalty
 * name contains "доставка" and the transfer fee contains "Поручение", so a
 * substring test would misfile both.
 */
export function classifyYandexDebit(productName: string | null | undefined): 'commission' | 'delivery' | 'other' {
  const n = (productName ?? '').trim()
  if (n === 'Доставка покупателю') return 'delivery'
  if (n === 'Поручение на продажу') return 'commission'
  return 'other'
}

export interface RealBucket {
  commission: number
  delivery: number
  // Non-commission, non-delivery marketplace deductions — storage, acquiring,
  // ads/boost, loyalty, penalties, etc. Previously these were silently folded
  // into `commission` (a catch-all), which made the commission line wrong while
  // leaving net correct. Now split out so the breakdown reconciles with the
  // seller's finance report. Uzum has explicit commission/delivery columns and
  // no separate "other", so it stays 0 there.
  other: number
  net: number
  itemCount: number   // >0 means real data is present; 0 → caller uses its own estimate
  ymItemCount: number // Yandex-only settled item count; lets callers tell whether
                      // YANDEX specifically has settled, not just the bucket overall
}

export async function getRealFinancialsByBucket(
  shopIds: string[],
  from: Date,
  bucket: 'day' | 'month',
): Promise<Map<string, RealBucket>> {
  const out = new Map<string, RealBucket>()
  if (shopIds.length === 0) return out

  const fmt = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'

  // Split shops by marketplace — settlement tables are per-marketplace,
  // and a mixed shopIds list wastes queries hitting both.
  const shopRows = await db.select({ id: shops.id, marketplace: shops.marketplace })
    .from(shops).where(inArray(shops.id, shopIds))
  const ymShopIds = shopRows.filter(r => r.marketplace === 'yandex_market').map(r => r.id)
  const uzShopIds = shopRows.filter(r => r.marketplace === 'uzum').map(r => r.id)

  const bump = (key: string, patch: Partial<RealBucket>) => {
    const cur = out.get(key) ?? { commission: 0, delivery: 0, other: 0, net: 0, itemCount: 0, ymItemCount: 0 }
    cur.commission  += patch.commission  ?? 0
    cur.delivery    += patch.delivery    ?? 0
    cur.other       += patch.other       ?? 0
    cur.net         += patch.net         ?? 0
    cur.itemCount   += patch.itemCount   ?? 0
    cur.ymItemCount += patch.ymItemCount ?? 0
    out.set(key, cur)
  }

  // ── Yandex: rows tagged Начисление (credit) vs Удержание (debit). The debit
  //    TYPE lives in product_name — the «…услуги (к удержанию)» column — NOT in
  //    order_type (which is always "Продажа физлицу"). classifyYandexDebit does
  //    the exact-name split: "Доставка покупателю" → delivery, "Поручение на
  //    продажу" → the real sales commission, everything else (penalties, transfer
  //    fees, storage, acquiring, ads, loyalty — and any blank/unnamed rows) →
  //    `other`. Net is unaffected regardless of the split (all debits subtract).
  if (ymShopIds.length > 0) {
    try {
      const rows = await db.select({
        bucket:       sql<string>`to_char(${yandexSettlementTransactions.transaction_at}, ${sql.raw(`'${fmt}'`)})`.as('bucket'),
        entry_type:   yandexSettlementTransactions.entry_type,
        product_name: yandexSettlementTransactions.product_name,
        amount:       yandexSettlementTransactions.amount,
      }).from(yandexSettlementTransactions)
        .where(and(
          inArray(yandexSettlementTransactions.shop_id, ymShopIds),
          gte(yandexSettlementTransactions.transaction_at, from),
        ))
      const perBucket = new Map<string, { credit: number; commission: number; delivery: number; other: number; itemCount: number }>()
      for (const r of rows) {
        if (!r.bucket) continue
        const b = perBucket.get(r.bucket) ?? { credit: 0, commission: 0, delivery: 0, other: 0, itemCount: 0 }
        const amt = Number(r.amount)
        b.itemCount += 1
        if (r.entry_type === 'Начисление') b.credit += amt
        else b[classifyYandexDebit(r.product_name)] += amt
        perBucket.set(r.bucket, b)
      }
      for (const [k, v] of perBucket) {
        bump(k, {
          commission: v.commission,
          delivery: v.delivery,
          other: v.other,
          // net unchanged: commission + delivery + other == every debit, exactly
          // what the old (commission + delivery) sum was before `other` was split
          // out — so profit does not move, only the breakdown.
          net: v.credit - v.commission - v.delivery - v.other,
          itemCount: v.itemCount,
          ymItemCount: v.itemCount,
        })
      }
    } catch (e) {
      // Settlements table not migrated yet, or query failed. Log and
      // fall through — caller will use its own estimates.
      console.error('[real-financials] yandex query failed:', String(e).slice(0, 200))
    }
  }

  // ── Uzum: per-order-item rows with authoritative commission +
  //    delivery + net. Skip CANCELED items entirely (seller gets
  //    nothing, pays nothing).
  if (uzShopIds.length > 0) {
    try {
      const rows = await db.select({
        bucket:           sql<string>`to_char(${uzumSettlementOrders.transaction_at}, ${sql.raw(`'${fmt}'`)})`.as('bucket'),
        status:           uzumSettlementOrders.status,
        seller_price:     uzumSettlementOrders.seller_price,
        commission:       uzumSettlementOrders.commission,
        delivery:         uzumSettlementOrders.logistic_delivery_fee,
        withdrawn_profit: uzumSettlementOrders.withdrawn_profit,
        seller_profit:    uzumSettlementOrders.seller_profit,
      }).from(uzumSettlementOrders)
        .where(and(
          inArray(uzumSettlementOrders.shop_id, uzShopIds),
          gte(uzumSettlementOrders.transaction_at, from),
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
 * Key insight for Yandex: this seller's netting shows commission +
 * delivery + acquiring all bundled into "Оплата услуг Market Yandex
 * Go" charges tagged as "Продажа физлицу" order_type. So the "commission"
 * we compute IS the bundled total, and delivery = 0. UnitEconomicsTable
 * should render delivery=0 for Yandex without a separate line.
 */
export interface RealRateForSku {
  marketplace: MarketplaceType
  commissionPct: number   // real commission as % of seller_price
  deliveryPct: number     // real delivery as % of seller_price (0 for Yandex — bundled)
  itemCount: number       // number of settled items backing this rate
  windowSince: string     // ISO date the rate was computed from
}

/**
 * Normalise a SKU for cross-source matching. Uzum stores compound
 * SKUs like "5124786-JMJ16BEG" (vendorId-yourSKU); Yandex stores just
 * the seller's own SKU; the extension may pass yet another variant.
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
  const ymShopIds = userShops.filter(s => s.marketplace === 'yandex_market').map(s => s.id)
  const uzShopIds = userShops.filter(s => s.marketplace === 'uzum').map(s => s.id)

  // Yandex — aggregate by sku over the whole shop. Credit rows carry
  // seller_price (Начисление · Платёж покупателя), debit rows carry the
  // fees. Both share the same SKU column so a single SUM query per
  // marketplace works.
  if (ymShopIds.length > 0) {
    try {
      const rows = await db.select({
        sku:          yandexSettlementTransactions.sku,
        entry_type:   yandexSettlementTransactions.entry_type,
        product_name: yandexSettlementTransactions.product_name,
        amount:       yandexSettlementTransactions.amount,
      }).from(yandexSettlementTransactions)
        .where(and(
          inArray(yandexSettlementTransactions.shop_id, ymShopIds),
          gte(yandexSettlementTransactions.transaction_at, since),
        ))
      const perSku = new Map<string, { gross: number; commission: number; delivery: number; itemCount: number }>()
      for (const r of rows) {
        const sku = (r.sku ?? '').trim()
        if (!sku) continue
        const b = perSku.get(sku) ?? { gross: 0, commission: 0, delivery: 0, itemCount: 0 }
        const amt = Number(r.amount)
        b.itemCount += 1
        if (r.entry_type === 'Начисление') {
          b.gross += amt
        } else {
          // Classify by the service name (product_name), like the P&L / Payouts.
          // A per-SKU RATE is the standard commission + delivery only — one-off
          // "other" fees (penalties, transfer, storage, ads) are NOT part of the
          // rate a seller prices against, so they're excluded here.
          const cls = classifyYandexDebit(r.product_name)
          if (cls === 'delivery') b.delivery += amt
          else if (cls === 'commission') b.commission += amt
        }
        perSku.set(sku, b)
      }
      for (const [sku, v] of perSku) {
        if (v.gross <= 0) continue
        const rate: RealRateForSku = {
          marketplace:  'yandex_market',
          commissionPct: (v.commission / v.gross) * 100,
          deliveryPct:   (v.delivery   / v.gross) * 100,
          itemCount:     v.itemCount,
          windowSince:   sinceIso,
        }
        out.set(sku, rate)
        // Also index under normalised form so UE items whose stored
        // SKU differs only in case / punctuation still match.
        const norm = normSku(sku)
        if (norm && norm !== sku) out.set(norm, rate)
      }
    } catch (e) {
      console.error('[real-financials] yandex per-sku failed:', String(e).slice(0, 200))
    }
  }

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
