import { eq, sql } from 'drizzle-orm'
import { db, shops, yandexSettlementTransactions } from '@/lib/db'
import { fetchCampaignInfo } from './client'
import {
  generateNettingReport,
  pollReportUntilReady,
  downloadReport,
  parseNettingReport,
} from './netting-report'

/**
 * Fetch and store Yandex Market's real settlement transactions for one
 * shop. Idempotent — upsert on (shop_id, transaction_id).
 *
 * `windowDays` defaults to 7 — Yandex publishes settlement data within
 * 1–2 days of delivery, so a 7-day window catches everything fresh on
 * each cron run while keeping the report small (Yandex charges API
 * quota per row, and a smaller window generates faster). New sellers
 * or backfill jobs can pass a larger number.
 */
export interface SettlementsSyncResult {
  ok: boolean
  inserted: number
  error?: string
  skipped?: string
  debug?: Record<string, unknown>
}

export async function syncYandexSettlements(
  shopId: string,
  token: string,
  campaignId: string,
  windowDays = 7,
): Promise<SettlementsSyncResult> {
  // Yandex's netting-report API is scoped to businessId, not campaignId.
  // Resolve one from the other.
  let businessId: number | undefined
  const shopRow = await db.select({ business_id: shops.business_id }).from(shops).where(eq(shops.id, shopId)).limit(1)
  if (shopRow[0]?.business_id && /^\d+$/.test(shopRow[0].business_id)) {
    businessId = Number(shopRow[0].business_id)
  }
  if (!businessId) {
    try {
      const info = await fetchCampaignInfo(token, campaignId)
      businessId = info.businessId
      if (businessId) {
        await db.update(shops).set({ business_id: String(businessId) }).where(eq(shops.id, shopId))
      }
    } catch (e) {
      return { ok: false, inserted: 0, error: `Could not resolve businessId from campaignId ${campaignId}: ${String(e).slice(0, 200)}` }
    }
  }
  if (!businessId) {
    return { ok: false, inserted: 0, error: 'No businessId available for this Yandex shop.' }
  }

  const now = new Date()
  const dateTo = now.toISOString().slice(0, 10)
  const from = new Date(now)
  from.setDate(from.getDate() - windowDays)
  const dateFrom = from.toISOString().slice(0, 10)

  let reportId: string
  try {
    reportId = await generateNettingReport(token, businessId, dateFrom, dateTo)
  } catch (e) {
    return { ok: false, inserted: 0, error: `generate: ${String(e).slice(0, 300)}`, debug: { businessId, dateFrom, dateTo } }
  }

  let status
  try {
    status = await pollReportUntilReady(token, reportId)
  } catch (e) {
    return { ok: false, inserted: 0, error: `poll: ${String(e).slice(0, 300)}`, debug: { reportId, businessId, dateFrom, dateTo } }
  }
  if (status.status === 'NO_DATA') {
    return { ok: true, inserted: 0, skipped: 'no transactions in window', debug: { reportId, status: status.status, dateFrom, dateTo } }
  }
  if (status.status !== 'DONE' || !status.fileUrl) {
    return { ok: false, inserted: 0, error: `report status=${status.status}, fileUrl=${status.fileUrl ?? 'null'}`, debug: { reportId, status: status.status } }
  }

  let buffer: ArrayBuffer
  try {
    buffer = await downloadReport(status.fileUrl, token)
  } catch (e) {
    return { ok: false, inserted: 0, error: `download: ${String(e).slice(0, 300)}`, debug: { reportId, fileUrl: status.fileUrl } }
  }

  const parsed = parseNettingReport(buffer)
  if (parsed.length === 0) {
    return { ok: true, inserted: 0, skipped: 'parsed 0 transactions from a non-empty XLSX (parser miss?)', debug: { reportId, bufferBytes: buffer.byteLength } }
  }

  // Signed amount convention: negative for "Удержание", positive for
  // "Начисление". Yandex's XLSX shows delivery/commission with an
  // already-negative sign, so we normalize here rather than relying on
  // caller conventions.
  const rows = parsed.map(t => ({
    shop_id:            shopId,
    transaction_id:     t.transactionId,
    order_id_external:  t.orderIdExternal,
    entry_type:         t.entryType,
    entry_source:       t.entrySource,
    order_type:         t.orderType,
    sku:                t.sku,
    // Persist absolute magnitude in `amount`; sign is derivable from
    // entry_type. That way math on the aggregator side is unambiguous.
    amount:             String(Math.abs(t.amount)),
    quantity:           t.quantity,
    transaction_at:     t.transactionAt,
    order_created_at:   t.orderCreatedAt,
    order_delivered_at: t.orderDeliveredAt,
    status_note:        t.statusNote,
    report_id:          reportId,
  }))

  // Chunked upsert — Postgres has a parameter limit around 65k, and each
  // row has ~14 columns.
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    await db.insert(yandexSettlementTransactions).values(slice).onConflictDoUpdate({
      target: [yandexSettlementTransactions.shop_id, yandexSettlementTransactions.transaction_id],
      set: {
        entry_type:         sql`excluded.entry_type`,
        entry_source:       sql`excluded.entry_source`,
        order_type:         sql`excluded.order_type`,
        sku:                sql`excluded.sku`,
        amount:             sql`excluded.amount`,
        quantity:           sql`excluded.quantity`,
        transaction_at:     sql`excluded.transaction_at`,
        order_created_at:   sql`excluded.order_created_at`,
        order_delivered_at: sql`excluded.order_delivered_at`,
        status_note:        sql`excluded.status_note`,
        report_id:          sql`excluded.report_id`,
        synced_at:          sql`now()`,
      },
    })
  }

  return { ok: true, inserted: rows.length }
}
