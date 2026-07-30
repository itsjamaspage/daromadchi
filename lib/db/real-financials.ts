import { inArray, gte, and, sql } from 'drizzle-orm'
import { db, shops, yandexSettlementTransactions, uzumSettlementOrders } from '@/lib/db'

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
export interface RealBucket {
  commission: number
  delivery: number
  net: number
  itemCount: number   // >0 means real data is present; 0 → caller uses its own estimate
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
    const cur = out.get(key) ?? { commission: 0, delivery: 0, net: 0, itemCount: 0 }
    cur.commission += patch.commission ?? 0
    cur.delivery   += patch.delivery   ?? 0
    cur.net        += patch.net        ?? 0
    cur.itemCount  += patch.itemCount  ?? 0
    out.set(key, cur)
  }

  // ── Yandex: rows tagged Начисление (credit) vs Удержание (debit),
  //    with order_type used to split delivery from commission (Yandex
  //    bundles a lot into "Услуги маркета" so most debits are commission).
  if (ymShopIds.length > 0) {
    try {
      const rows = await db.select({
        bucket:       sql<string>`to_char(${yandexSettlementTransactions.transaction_at}, ${sql.raw(`'${fmt}'`)})`.as('bucket'),
        entry_type:   yandexSettlementTransactions.entry_type,
        order_type:   yandexSettlementTransactions.order_type,
        amount:       yandexSettlementTransactions.amount,
      }).from(yandexSettlementTransactions)
        .where(and(
          inArray(yandexSettlementTransactions.shop_id, ymShopIds),
          gte(yandexSettlementTransactions.transaction_at, from),
        ))
      const perBucket = new Map<string, { credit: number; commission: number; delivery: number; itemCount: number }>()
      for (const r of rows) {
        if (!r.bucket) continue
        const b = perBucket.get(r.bucket) ?? { credit: 0, commission: 0, delivery: 0, itemCount: 0 }
        const amt = Number(r.amount)
        b.itemCount += 1
        if (r.entry_type === 'Начисление') b.credit += amt
        else {
          if ((r.order_type ?? '').includes('Доставка')) b.delivery += amt
          else b.commission += amt
        }
        perBucket.set(r.bucket, b)
      }
      for (const [k, v] of perBucket) {
        bump(k, {
          commission: v.commission,
          delivery: v.delivery,
          net: v.credit - v.commission - v.delivery,
          itemCount: v.itemCount,
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
        const withdrawn  = r.withdrawn_profit != null ? Number(r.withdrawn_profit) : null
        const profit     = r.seller_profit    != null ? Number(r.seller_profit)    : null
        // Same net preference as payouts.ts: withdrawnProfit (what
        // actually hit the balance) → sellerProfit (pre-release) →
        // derived (gross − commission − delivery).
        const net = withdrawn != null ? withdrawn
                  : profit    != null ? profit
                  : gross - commission - delivery
        bump(r.bucket, { commission, delivery, net, itemCount: 1 })
      }
    } catch (e) {
      console.error('[real-financials] uzum query failed:', String(e).slice(0, 200))
    }
  }

  return out
}
