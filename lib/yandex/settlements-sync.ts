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
 * `windowDays` defaults to 60 so a fresh install captures 2 months of
 * history. The nightly cron re-runs this for the same window every
 * night; new transactions from Yandex just upsert.
 */
export async function syncYandexSettlements(
  shopId: string,
  token: string,
  campaignId: string,
  windowDays = 60,
): Promise<{ ok: boolean; inserted: number; error?: string; skipped?: string }> {
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
    return { ok: false, inserted: 0, error: `generateNettingReport failed: ${String(e).slice(0, 200)}` }
  }

  const status = await pollReportUntilReady(token, reportId)
  if (status.status === 'NO_DATA') {
    return { ok: true, inserted: 0, skipped: 'no transactions in window' }
  }
  if (status.status !== 'DONE' || !status.fileUrl) {
    return { ok: false, inserted: 0, error: `Report status=${status.status}; no fileUrl.` }
  }

  let buffer: ArrayBuffer
  try {
    buffer = await downloadReport(status.fileUrl, token)
  } catch (e) {
    return { ok: false, inserted: 0, error: `downloadReport failed: ${String(e).slice(0, 200)}` }
  }

  const parsed = parseNettingReport(buffer)
  if (parsed.length === 0) {
    return { ok: true, inserted: 0, skipped: 'parsed 0 transactions' }
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
