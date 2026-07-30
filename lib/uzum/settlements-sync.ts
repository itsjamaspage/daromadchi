import { eq, sql } from 'drizzle-orm'
import { db, shops, uzumSettlementOrders } from '@/lib/db'
import { fetchUzumFinanceOrders, fetchUzumShops, type UzumFinanceOrderItem } from './client'

/**
 * Fetch and store Uzum's REAL per-order-item settlement data for one
 * shop. Idempotent — upsert on (shop_id, uzum_order_item_id).
 *
 * Uses GET /v1/finance/orders — the same view Uzum shows the seller
 * on their "Финансы → Продажи" screen, with authoritative commission,
 * delivery fee, and profit. Populates uzum_settlement_orders so
 * lib/db/payouts.ts can render real net-payout numbers instead of
 * estimating from Unit Economics percentages.
 *
 * `windowDays` defaults to 14 — Uzum's payout state can flip between
 * PROCESSING → TO_WITHDRAW → CANCELED for up to a few weeks after the
 * order, so a slightly wider window than Yandex catches those late
 * transitions on every cron run.
 */
export interface UzumSettlementsSyncResult {
  ok: boolean
  inserted: number
  error?: string
  skipped?: string
  debug?: Record<string, unknown>
}

export async function syncUzumSettlements(
  shopId: string,
  token: string,
  windowDays = 14,
): Promise<UzumSettlementsSyncResult> {
  // The Uzum finance endpoint is scoped to Uzum shop IDs (numeric),
  // NOT our internal shop UUID. Resolve them from /v1/shops on the fly
  // — a single seller token can own multiple Uzum shops and this
  // returns all of them.
  let uzumShopIds: number[]
  try {
    const shops = await fetchUzumShops(token)
    uzumShopIds = shops.map(s => s.id).filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  } catch (e) {
    return { ok: false, inserted: 0, error: `resolve shops: ${String(e).slice(0, 300)}` }
  }
  if (uzumShopIds.length === 0) {
    return { ok: false, inserted: 0, error: 'no Uzum shops returned for this token' }
  }

  const now = Date.now()
  const dateTo = now
  const dateFrom = now - windowDays * 24 * 60 * 60 * 1000

  // Page through /v1/finance/orders. Uzum caps size at 100; break on
  // an empty page or after we've read everything the totalElements
  // header advertised, whichever comes first. Hard-cap at 100 pages
  // (10 000 items) so a broken totalElements can't loop forever.
  const items: UzumFinanceOrderItem[] = []
  let totalReported = 0
  try {
    for (let page = 0; page < 100; page++) {
      const r = await fetchUzumFinanceOrders(token, uzumShopIds, page, 100, dateFrom, dateTo)
      totalReported = r.totalElements
      if (r.items.length === 0) break
      items.push(...r.items)
      if (items.length >= totalReported && totalReported > 0) break
    }
  } catch (e) {
    return { ok: false, inserted: 0, error: `fetch: ${String(e).slice(0, 300)}`, debug: { uzumShopIds, dateFrom, dateTo, gotSoFar: items.length } }
  }

  if (items.length === 0) {
    return { ok: true, inserted: 0, skipped: 'no finance/orders items in window', debug: { uzumShopIds, dateFrom, dateTo, totalReported } }
  }

  const rows = items.map(it => {
    const toDate = (ms?: number) => (typeof ms === 'number' && Number.isFinite(ms)) ? new Date(ms) : null
    return {
      shop_id:               shopId,
      uzum_order_item_id:    Number(it.id),
      uzum_order_id:         Number(it.orderId),
      uzum_shop_id:          it.shopId != null ? Number(it.shopId) : null,
      product_id:            it.productId != null ? Number(it.productId) : null,
      product_title:         it.productTitle ?? null,
      sku_title:             it.skuTitle ?? null,
      status:                it.status,
      transaction_at:        toDate(it.date),
      date_issued_at:        toDate(it.dateIssued),
      seller_price:          String(it.sellerPrice ?? 0),
      commission:            String(it.commission ?? 0),
      seller_profit:         it.sellerProfit != null ? String(it.sellerProfit) : null,
      withdrawn_profit:      it.withdrawnProfit != null ? String(it.withdrawnProfit) : null,
      purchase_price:        it.purchasePrice != null ? String(it.purchasePrice) : null,
      logistic_delivery_fee: String(it.logisticDeliveryFee ?? 0),
      amount:                it.amount ?? null,
      amount_returns:        it.amountReturns ?? null,
      cancelled:             it.cancelled ?? null,
      return_cause:          it.returnCause ?? null,
      comment:               it.comment ?? null,
    }
  })

  // Chunked upsert — same 500-row batch size as the Yandex sync (Postgres'
  // parameter limit ~65k, this table has ~20 columns).
  const CHUNK = 500
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      await db.insert(uzumSettlementOrders).values(slice).onConflictDoUpdate({
        target: [uzumSettlementOrders.shop_id, uzumSettlementOrders.uzum_order_item_id],
        set: {
          status:                sql`excluded.status`,
          transaction_at:        sql`excluded.transaction_at`,
          date_issued_at:        sql`excluded.date_issued_at`,
          seller_price:          sql`excluded.seller_price`,
          commission:            sql`excluded.commission`,
          seller_profit:         sql`excluded.seller_profit`,
          withdrawn_profit:      sql`excluded.withdrawn_profit`,
          purchase_price:        sql`excluded.purchase_price`,
          logistic_delivery_fee: sql`excluded.logistic_delivery_fee`,
          amount:                sql`excluded.amount`,
          amount_returns:        sql`excluded.amount_returns`,
          cancelled:             sql`excluded.cancelled`,
          return_cause:          sql`excluded.return_cause`,
          comment:               sql`excluded.comment`,
          product_title:         sql`excluded.product_title`,
          sku_title:             sql`excluded.sku_title`,
          uzum_shop_id:          sql`excluded.uzum_shop_id`,
          product_id:            sql`excluded.product_id`,
          synced_at:             sql`now()`,
        },
      })
    }
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause
    const pick = (obj: unknown) => {
      if (obj == null || typeof obj !== 'object') return null
      const out: Record<string, unknown> = {}
      for (const k of ['message', 'code', 'detail', 'constraint', 'column', 'table', 'severity']) {
        const v = (obj as Record<string, unknown>)[k]
        if (v !== undefined) out[k] = v
      }
      return out
    }
    return {
      ok: false,
      inserted: 0,
      error: `insert: ${(e as { message?: string }).message ?? String(e)}`.slice(0, 2000),
      debug: { rowCount: rows.length, errorOuter: pick(e), errorCause: pick(cause), firstRow: rows[0] },
    }
  }

  // Confirm the shop row exists (defensive — settlements can only reference
  // a real shop). No-op if it does; if it's missing the FK would have
  // already thrown above anyway.
  await db.select({ id: shops.id }).from(shops).where(eq(shops.id, shopId)).limit(1)

  return { ok: true, inserted: rows.length }
}
