import { eq, sql } from 'drizzle-orm'
import { db, shops, productAdsStats } from '@/lib/db'
import { fetchCampaignInfo } from './client'
import {
  generateBoostReport,
  pollReportUntilReady,
  downloadReport,
  parseBoostReport,
  describeNettingReport,
} from './boost-report'

/**
 * Fetch and store Yandex Market's real advertising (Буст продаж) spend for one
 * shop, split into cash vs. bonus. Idempotent — upsert on
 * (shop_id, sku, date) where sku = `ymcamp:{campaignId}`.
 *
 * Mirrors lib/yandex/settlements-sync.ts: businessId self-heal, async
 * generate→poll→download→parse, and the same result shape (debug + XLSX shape
 * snapshot on a parse-miss).
 *
 * CRITICAL: cash_spend and bonus_spend are stored SEPARATELY and
 * spend = cash + bonus. The Взаимозачёт credit lands in "Списано бонусов", and
 * cash can be 0 while bonus is not — never drop bonus.
 *
 * `windowDays` defaults to 14 — boost spend, like settlements, can be revised
 * for a few days, so a slightly wider window catches late adjustments.
 */
export interface SettlementsSyncResult {
  ok: boolean
  inserted: number
  error?: string
  skipped?: string
  debug?: Record<string, unknown>
}

export async function syncYandexBoostSpend(
  shopId: string,
  token: string,
  campaignId: string,
  windowDays = 14,
): Promise<SettlementsSyncResult> {
  // Yandex's report API is scoped to businessId, not campaignId. Self-heal any
  // shop whose stored business_id equals its campaignId (an early-flow bug) by
  // re-fetching via /v2/campaigns/{campaignId}. Same logic as settlements-sync.
  let businessId: number | undefined
  const shopRow = await db.select({ business_id: shops.business_id }).from(shops).where(eq(shops.id, shopId)).limit(1)
  const storedBid = shopRow[0]?.business_id
  const storedLooksValid = storedBid && /^\d+$/.test(storedBid) && storedBid !== campaignId
  if (storedLooksValid) {
    businessId = Number(storedBid)
  }
  if (!businessId) {
    try {
      const info = await fetchCampaignInfo(token, campaignId)
      businessId = info.businessId
      if (businessId && String(businessId) !== campaignId) {
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
    reportId = await generateBoostReport(token, businessId, dateFrom, dateTo)
  } catch (e) {
    // LOUD: the real Yandex reason (INVALID_REQUEST + field) now rides in the
    // error message (see boost-report.ts yandexRequest). Log it so it lands in
    // the cron log this run instead of hiding as a generic "skipped".
    const msg = `generate: ${String(e).slice(0, 500)}`
    console.error('[yandex-boost] FAILED', { shopId, businessId, dateFrom, dateTo, error: msg })
    return { ok: false, inserted: 0, error: msg, debug: { businessId, dateFrom, dateTo } }
  }

  let status
  try {
    status = await pollReportUntilReady(token, reportId)
  } catch (e) {
    const msg = `poll: ${String(e).slice(0, 500)}`
    console.error('[yandex-boost] FAILED', { shopId, reportId, error: msg })
    return { ok: false, inserted: 0, error: msg, debug: { reportId, businessId, dateFrom, dateTo } }
  }
  if (status.status === 'NO_DATA') {
    console.log('[yandex-boost] no boost spend in window', { shopId, reportId, dateFrom, dateTo })
    return { ok: true, inserted: 0, skipped: 'no boost spend in window', debug: { reportId, status: status.status, dateFrom, dateTo } }
  }
  if (status.status !== 'DONE' || !status.fileUrl) {
    const msg = `report status=${status.status}, fileUrl=${status.fileUrl ?? 'null'}`
    console.error('[yandex-boost] FAILED', { shopId, reportId, error: msg })
    return { ok: false, inserted: 0, error: msg, debug: { reportId, status: status.status } }
  }

  let buffer: ArrayBuffer
  try {
    buffer = await downloadReport(status.fileUrl, token)
  } catch (e) {
    const msg = `download: ${String(e).slice(0, 500)}`
    console.error('[yandex-boost] FAILED', { shopId, reportId, error: msg })
    return { ok: false, inserted: 0, error: msg, debug: { reportId, fileUrl: status.fileUrl } }
  }

  const parsed = parseBoostReport(buffer)
  if (parsed.length === 0) {
    // Report downloaded but parsed to 0 rows from a non-empty file → parser
    // miss. Log the shape snapshot (sheet names + first rows) so the parser
    // can be reconciled against the real sheet without another blind deploy.
    const shape = describeNettingReport(buffer)
    console.error('[yandex-boost] parsed 0 rows from non-empty XLSX (parser miss)', { shopId, reportId, bufferBytes: buffer.byteLength, shape: JSON.stringify(shape).slice(0, 2000) })
    return { ok: true, inserted: 0, skipped: 'parsed 0 boost rows from a non-empty XLSX (parser miss?)', debug: { reportId, bufferBytes: buffer.byteLength, shape } }
  }

  // Aggregate per (date, campaignId) — the report is usually already one row
  // per campaign per day, but summing defends against any split rows.
  const agg = new Map<string, {
    date: string; campaignId: string; campaignName: string
    impressions: number; clicks: number; cashSpend: number; bonusSpend: number
  }>()
  for (const r of parsed) {
    const key = `${r.date}|${r.campaignId}`
    const ex = agg.get(key) ?? {
      date: r.date, campaignId: r.campaignId, campaignName: r.campaignName,
      impressions: 0, clicks: 0, cashSpend: 0, bonusSpend: 0,
    }
    ex.impressions += r.impressions
    ex.clicks      += r.clicks
    ex.cashSpend   += r.cashSpend
    ex.bonusSpend  += r.bonusSpend
    if (!ex.campaignName && r.campaignName) ex.campaignName = r.campaignName
    agg.set(key, ex)
  }

  const rows = [...agg.values()].map(v => ({
    shop_id:      shopId,
    // Synthetic per-campaign key — satisfies the not-null sku + the unique
    // (shop_id, sku, date) index so each campaign/day upserts to its own row.
    sku:          `ymcamp:${v.campaignId}`,
    date:         v.date,
    marketplace:  'yandex_market',
    impressions:  v.impressions,
    clicks:       v.clicks,
    // spend = cash + bonus. Bonus (Взаимозачёт credit) is never dropped.
    spend:        String(v.cashSpend + v.bonusSpend),
    cash_spend:   String(v.cashSpend),
    bonus_spend:  String(v.bonusSpend),
    source_label: 'yandex-boost',
  }))

  const CHUNK = 500
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      await db.insert(productAdsStats).values(slice).onConflictDoUpdate({
        target: [productAdsStats.shop_id, productAdsStats.sku, productAdsStats.date],
        set: {
          impressions:  sql`excluded.impressions`,
          clicks:       sql`excluded.clicks`,
          spend:        sql`excluded.spend`,
          cash_spend:   sql`excluded.cash_spend`,
          bonus_spend:  sql`excluded.bonus_spend`,
          marketplace:  sql`excluded.marketplace`,
          source_label: sql`excluded.source_label`,
        },
      })
    }
  } catch (e) {
    const errCause = (e as { cause?: unknown }).cause
    const pick = (obj: unknown) => {
      if (obj == null || typeof obj !== 'object') return null
      const out: Record<string, unknown> = {}
      for (const k of ['message', 'code', 'detail', 'constraint', 'column', 'table', 'severity']) {
        const v = (obj as Record<string, unknown>)[k]
        if (v !== undefined) out[k] = v
      }
      return out
    }
    const msg = `insert: ${(e as { message?: string }).message ?? String(e)}`.slice(0, 2000)
    console.error('[yandex-boost] FAILED', { shopId, reportId, error: msg, errorCause: pick(errCause) })
    return {
      ok: false,
      inserted: 0,
      error: msg,
      debug: { reportId, rowCount: rows.length, errorOuter: pick(e), errorCause: pick(errCause), firstRow: rows[0] },
    }
  }

  console.log('[yandex-boost] OK', { shopId, reportId, inserted: rows.length, dateFrom, dateTo })
  return { ok: true, inserted: rows.length }
}
