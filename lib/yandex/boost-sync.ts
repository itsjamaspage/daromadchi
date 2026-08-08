import { eq, sql } from 'drizzle-orm'
import { db, shops, productAdsStats } from '@/lib/db'
import { fetchCampaignInfo, YandexApiError } from './client'
import {
  generateBoostReport,
  pollReportUntilReady,
  downloadReport,
  parseBoostReport,
  diagnoseBoostReport,
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
  opts: { ignoreCooldown?: boolean } = {},
): Promise<SettlementsSyncResult> {
  // Yandex's report API is scoped to businessId, not campaignId. Self-heal any
  // shop whose stored business_id equals its campaignId (an early-flow bug) by
  // re-fetching via /v2/campaigns/{campaignId}. Same logic as settlements-sync.
  let businessId: number | undefined
  const shopRow = await db.select({
    business_id: shops.business_id,
    boostDisabledAt: shops.yandex_boost_disabled_at,
  }).from(shops).where(eq(shops.id, shopId)).limit(1)
  const storedBid = shopRow[0]?.business_id

  // The boost-consolidated report is a SEPARATE permission on the seller's API
  // key. A key without advertising access hard-403s on every generate; without a
  // cooldown that re-fires each cron cycle and floods the seller's
  // "Ошибки · API Маркета" log at 100%. After a 403 we skip boost sync and
  // re-probe only ~weekly (self-heals if the seller later grants access).
  // A MANUAL/on-demand sync (opts.ignoreCooldown) always re-probes boost right
  // now: the seller has just granted the API key «Продвижение» access and wants
  // the data immediately, not after the weekly cron re-probe. The automatic cron
  // path passes no flag, so its weekly back-off here is unchanged. On a
  // successful generate the cooldown is cleared further down, so the normal cron
  // resumes fetching boost every cycle.
  const BOOST_REPROBE_MS = 7 * 24 * 60 * 60_000
  const disabledAt = shopRow[0]?.boostDisabledAt
  if (!opts.ignoreCooldown && disabledAt && Date.now() - new Date(disabledAt).getTime() < BOOST_REPROBE_MS) {
    return { ok: true, inserted: 0, skipped: 'boost report disabled after 403 (API key lacks advertising access) — re-probing weekly' }
  }
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
    // 403 = the API key can't read the boost report (no advertising access).
    // This is a permission wall, not a transient error — retrying every cycle
    // only spams the seller's API error log. Stamp the cooldown and skip quietly
    // (re-probed ~weekly); do NOT report it as a failure.
    const status = e instanceof YandexApiError ? e.status : (/(^|\D)403(\D|$)/.test(String(e)) ? 403 : 0)
    if (status === 403) {
      await db.update(shops).set({ yandex_boost_disabled_at: new Date() }).where(eq(shops.id, shopId)).catch(() => {})
      console.warn('[yandex-boost] 403 FORBIDDEN — API key lacks boost/advertising report access; backing off (weekly re-probe)', { shopId, businessId })
      return { ok: true, inserted: 0, skipped: 'boost report forbidden (403) — API key lacks advertising access; backing off (weekly re-probe)', debug: { businessId } }
    }
    // LOUD: the real Yandex reason (INVALID_REQUEST + field) now rides in the
    // error message (see boost-report.ts yandexRequest). Log it so it lands in
    // the cron log this run instead of hiding as a generic "skipped".
    const msg = `generate: ${String(e).slice(0, 500)}`
    console.error('[yandex-boost] FAILED', { shopId, businessId, dateFrom, dateTo, error: msg })
    return { ok: false, inserted: 0, error: msg, debug: { businessId, dateFrom, dateTo } }
  }
  // generate succeeded → boost access is fine; lift any prior 403 cooldown so a
  // seller who just granted access recovers immediately.
  if (disabledAt) {
    await db.update(shops).set({ yandex_boost_disabled_at: null }).where(eq(shops.id, shopId)).catch(() => {})
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

  // Pass dateTo as the fallback date: the consolidated report is often one
  // row per campaign for the whole window with no per-day Дата, and without a
  // fallback those rows would be dropped (a primary cause of 0 parsed rows).
  const parsed = parseBoostReport(buffer, dateTo)
  if (parsed.length === 0) {
    // Zero rows has THREE distinct causes that otherwise look identical from an
    // empty product_ads_stats. Diagnose which, so the log says exactly which —
    // an empty report (Yandex settles spend ~1 day in arrears) must NOT read as
    // a bug, and a real parser/structure miss must NOT read as harmless lag.
    const diag = diagnoseBoostReport(buffer)
    if (!diag.headerFound) {
      // No recognizable boost header anywhere → structure unexpected. Real
      // problem: dump the shape so the parser can be reconciled.
      const shape = describeNettingReport(buffer)
      console.error('[yandex-boost] STRUCTURE UNRECOGNIZED — no boost header found', { shopId, reportId, bufferBytes: buffer.byteLength, diag, shape: JSON.stringify(shape).slice(0, 2000) })
      return { ok: true, inserted: 0, skipped: 'boost report structure unrecognized (no header)', debug: { reportId, reason: 'header_not_found', diag, shape } }
    }
    if (diag.dataRowsBelowHeader === 0) {
      // Header present, zero data rows → the report is genuinely empty. Yandex
      // finalizes "Фактические расходы"/"Списано бонусов" ~1 day in arrears, so
      // recent spend simply isn't in the downloadable report yet. Expected lag,
      // NOT an error — the next cron cycle after Yandex settles will pick it up.
      console.log('[yandex-boost] REPORT EMPTY (expected Yandex settlement lag ~1 day) — no finalized boost spend rows yet, will land on a later sync', { shopId, reportId, dateFrom, dateTo, diag })
      return { ok: true, inserted: 0, skipped: 'boost report empty — Yandex settlement lag (expected, not an error)', debug: { reportId, reason: 'empty_report_lag', diag } }
    }
    // Header AND data rows present but the parser extracted nothing → a real
    // parser miss. Dump the shape so column/date mapping can be reconciled.
    const shape = describeNettingReport(buffer)
    console.error('[yandex-boost] PARSER MISS — header + data rows present but parsed 0', { shopId, reportId, bufferBytes: buffer.byteLength, diag, shape: JSON.stringify(shape).slice(0, 2000) })
    return { ok: true, inserted: 0, skipped: 'boost parser miss — header + rows present, parsed 0', debug: { reportId, reason: 'parser_miss', diag, shape } }
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
    // When the report carries no campaign id (aggregated one-row report), fall
    // back to a stable constant so the row still lands and upserts cleanly.
    sku:          v.campaignId ? `ymcamp:${v.campaignId}` : 'yandex-boost',
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
