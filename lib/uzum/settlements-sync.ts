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

  // Page through /v1/finance/orders. Uzum caps size at 100 per page.
  // Bound both call count and wall-clock so a slow Uzum response or a
  // huge backfill can't push us past nginx's ~60s upstream timeout —
  // returning a partial batch is better than a 504 that shows the seller
  // nothing at all.
  const items: UzumFinanceOrderItem[] = []
  let totalReported = 0
  let firstPageRawShape: string | undefined
  let firstProbedUrl: string | undefined
  const startedAt = Date.now()
  const DEADLINE_MS = 45_000 // leave ~15s headroom under nginx's 60s cap
  let deadlineHit = false
  const fetchPages = async (from: number | undefined, to: number | undefined, maxPages: number) => {
    for (let page = 0; page < maxPages; page++) {
      if (Date.now() - startedAt > DEADLINE_MS) { deadlineHit = true; break }
      const r = await fetchUzumFinanceOrders(token, uzumShopIds, page, 100, from, to)
      totalReported = r.totalElements
      if (page === 0) { firstPageRawShape = r.rawShape; firstProbedUrl = r.probedUrl }
      if (r.items.length === 0) break
      items.push(...r.items)
      if (items.length >= totalReported && totalReported > 0) break
    }
  }
  try {
    // Dated call — sellers with normal volume land under 5 pages here.
    await fetchPages(dateFrom, dateTo, 20)
    // Fallback: if the dated call came up empty, retry WITHOUT the date
    // filter. Uzum's endpoint may filter by payout date (which lags
    // order date by weeks — user's own screenshot showed "К выплате 7
    // августа" for a Jul 26 delivery), so a 14-day window can miss
    // recent orders whose payout hasn't been scheduled yet. Cap the
    // fallback at 10 pages (1 000 items) so a large-history shop can't
    // trip the timeout; recent orders come first in Uzum's ordering so
    // 1 000 items comfortably covers weeks of activity.
    if (items.length === 0) {
      await fetchPages(undefined, undefined, 10)
      const filtered = items.filter(it => {
        const d = it.date ?? it.dateIssued
        return typeof d === 'number' && d >= dateFrom && d <= dateTo
      })
      items.length = 0
      items.push(...filtered)
    }
  } catch (e) {
    return { ok: false, inserted: 0, error: `fetch: ${String(e).slice(0, 300)}`, debug: { uzumShopIds, dateFrom, dateTo, gotSoFar: items.length, probedUrl: firstProbedUrl, elapsedMs: Date.now() - startedAt } }
  }

  if (items.length === 0) {
    // Include the raw first-page response snapshot so we can tell whether
    // the window was genuinely empty vs. we parsed the wrong envelope path.
    return { ok: true, inserted: 0, skipped: deadlineHit ? 'timed out before Uzum returned data' : 'no finance/orders items in window', debug: { uzumShopIds, dateFrom, dateTo, dateFromIso: new Date(dateFrom).toISOString(), dateToIso: new Date(dateTo).toISOString(), totalReported, rawShape: firstPageRawShape, probedUrl: firstProbedUrl, deadlineHit, elapsedMs: Date.now() - startedAt } }
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
