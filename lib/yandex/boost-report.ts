import * as XLSX from 'xlsx'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { YANDEX_API_BASE, YandexApiError } from './client'
// Reuse the async-report plumbing that already backs the netting report:
// generation is kicked off, then polled to DONE, then the XLSX is downloaded.
// getReportStatus / pollReportUntilReady / downloadReport / describeNettingReport
// are marketplace-agnostic, so we import them rather than re-implement.
export {
  getReportStatus,
  pollReportUntilReady,
  downloadReport,
  describeNettingReport,
} from './netting-report'

// ─────────────────────────────────────────────────────────────────────────────
// Yandex Market — boost-consolidated (Буст продаж) spend report.
//
// The seller's advertising cost on Yandex Market's "Буст продаж" lives in the
// boost-consolidated report — the same XLSX a seller downloads from the
// Продвижение → Отчёты screen. The API is asynchronous, identical in shape to
// the netting report:
//   1. POST /reports/boost-consolidated/generate → reportId
//   2. GET  /reports/info/{reportId}             → poll until DONE
//   3. GET  {file}                               → downloads XLSX
//
// CRITICAL: spend is split into cash ("Фактические расходы") and bonus
// ("Списано бонусов" — the Взаимозачёт credit). Both are returned separately so
// the caller can store them apart and set spend = cash + bonus (cash may be 0
// while bonus is not). See lib/yandex/boost-sync.ts.
// ─────────────────────────────────────────────────────────────────────────────

async function yandexRequest<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await marketplaceFetch(`${YANDEX_API_BASE}${path}`, {
    ...options,
    headers: {
      'Api-Key': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    // Fold the response body INTO the message. Yandex returns the real reason
    // (e.g. INVALID_REQUEST + which field is wrong) only in the body; without
    // this, downstream `String(e)` yields a bare "Yandex API 400 (…)" and the
    // actual cause is lost — which is exactly how a bad report request hid for
    // a full deploy cycle as a generic "skipped".
    const snippet = body ? ` — ${body.replace(/\s+/g, ' ').trim().slice(0, 500)}` : ''
    throw new YandexApiError(res.status, `Yandex API ${res.status} (${path})${snippet}`, body)
  }
  return await res.json() as T
}

/**
 * Kick off boost-consolidated report generation. Returns Yandex's reportId —
 * poll it with getReportStatus until DONE. Mirrors generateNettingReport:
 * clamps dateTo to just-before-now (Yandex rejects a future upper bound with
 * 400) and preserves the requested dateFrom exactly.
 *
 * Body: { businessId, dateTimeFrom, dateTimeTo }.
 */
export async function generateBoostReport(
  token: string,
  businessId: number,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string,   // YYYY-MM-DD (upper bound, clamped to now)
): Promise<string> {
  interface GenerateResponse {
    result?: { reportId?: string; estimatedGenerationTime?: number }
    errors?: { code: string; message: string }[]
  }

  const now = new Date(Date.now() - 60_000)
  const requestedEndOfDay = new Date(`${dateTo}T23:59:59Z`)
  const upper = requestedEndOfDay > now ? now : requestedEndOfDay
  const dateTimeTo = upper.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const body = JSON.stringify({
    businessId,
    dateTimeFrom: `${dateFrom}T00:00:00Z`,
    dateTimeTo,
  })

  // `format` is a QUERY parameter on Yandex's report-generate endpoints, and
  // the boost-consolidated endpoint rejects generation with INVALID_REQUEST
  // when it isn't given an explicit, valid format. Request XLSX — the format
  // parseBoostReport() reads (the netting report happens to work off Yandex's
  // default, but boost does not, so we state it outright). Query string still
  // matches the guard's `/reports/[a-z-]+/generate` allowlist entry (the
  // pattern is an unanchored substring test on the path).
  const data = await yandexRequest<GenerateResponse>(
    `/reports/boost-consolidated/generate?format=XLSX`,
    token,
    { method: 'POST', body },
  )
  const id = data.result?.reportId
  if (!id) {
    throw new Error(`Yandex boost report generate returned no reportId. Body: ${JSON.stringify(data).slice(0, 400)}`)
  }
  return id
}

export interface BoostRow {
  date: string          // YYYY-MM-DD
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  cashSpend: number     // "Фактические расходы, сум"
  bonusSpend: number    // "Списано бонусов" (Взаимозачёт credit)
}

// Yandex tweaks column labels between report versions — match by any of a list
// of candidates, whitespace/case-insensitive, startsWith-friendly.
function normHeader(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}
function findCol(header: unknown[], candidates: string[]): number {
  const wanted = candidates.map(normHeader)
  return header.findIndex(h => {
    const n = normHeader(h)
    return wanted.some(w => n === w || n.startsWith(w))
  })
}

// Yandex numbers arrive as either a real number or a string like "1 234,56"
// (space thousands separator + comma decimal). Normalize to a JS number.
function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (v == null) return 0
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Yandex RU date "dd.MM.yyyy" (optionally with time) → YYYY-MM-DD.
function toDateStr(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && v.trim()) {
    const m = v.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  return null
}

// Column-label candidates. Yandex varies these between report versions
// (units suffix, non-breaking spaces, wording), so every lookup carries
// several synonyms and findCol() matches case/space-insensitively.
//
// CASH is the ACTUAL burn ("Фактические расходы") — deliberately NOT the
// "Расчётные расходы" estimate, which differs slightly (15 329 vs the real
// 14 776) and must never be what we store. BONUS is "Списано бонусов", the
// Взаимозачёт credit actually spent.
const BOOST_CASH_HEADERS  = ['Фактические расходы, сум', 'Фактические расходы', 'Фактический расход']
const BOOST_BONUS_HEADERS = ['Списано бонусов, сум', 'Списано бонусов']
const BOOST_DATE_HEADERS  = ['Дата', 'Период', 'Дата показа']
const BOOST_CID_HEADERS   = ['ID кампании', 'Идентификатор кампании', 'Номер кампании']
const BOOST_CNAME_HEADERS = ['Название кампании', 'Наименование кампании', 'Кампания']
const BOOST_IMPR_HEADERS  = ['Показы, шт.', 'Показы']
const BOOST_CLICK_HEADERS = ['Клики, шт.', 'Клики']

/**
 * Parse the boost-consolidated XLSX. The header row is NOT row 0 (there are
 * title/notes rows above it), so we scan every sheet for the header row — and
 * we anchor that scan on the SPEND columns themselves (cash or bonus), not on
 * 'ID кампании'. Report versions that omit/relabel the id column, or that
 * aggregate one row per campaign with no per-day Дата, previously parsed to
 * zero rows even from a valid report; anchoring on spend + tolerating a
 * missing date (via fallbackDate) fixes that.
 *
 * `fallbackDate` (the report window's end date) is used when a data row has no
 * usable Дата cell — the consolidated report is frequently one row per
 * campaign for the whole requested window. Without it those rows would be
 * dropped and real spend would silently vanish.
 */
export function parseBoostReport(buffer: ArrayBuffer, fallbackDate?: string): BoostRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  // Find the header row by the columns we actually need: the first row (in the
  // first sheet) that carries at least one spend column. Anchoring on spend
  // survives id/date column drift.
  let rows: unknown[][] = []
  let headerIdx = -1
  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name]
    if (!s) continue
    const r: unknown[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: true, defval: null })
    const idx = r.findIndex(row =>
      Array.isArray(row) &&
      (findCol(row, BOOST_CASH_HEADERS) >= 0 || findCol(row, BOOST_BONUS_HEADERS) >= 0))
    if (idx >= 0) { rows = r; headerIdx = idx; break }
  }
  if (headerIdx < 0) return []
  const header = rows[headerIdx] as (string | null)[]

  const idxDate         = findCol(header, BOOST_DATE_HEADERS)
  const idxCampaignId   = findCol(header, BOOST_CID_HEADERS)
  const idxCampaignName = findCol(header, BOOST_CNAME_HEADERS)
  const idxImpressions  = findCol(header, BOOST_IMPR_HEADERS)
  const idxClicks       = findCol(header, BOOST_CLICK_HEADERS)
  const idxCash         = findCol(header, BOOST_CASH_HEADERS)
  const idxBonus        = findCol(header, BOOST_BONUS_HEADERS)

  // Need at least ONE spend column — bonus alone is valid (boost credit can be
  // burned entirely from the Взаимозачёт balance with cash = 0). Requiring
  // both used to zero the whole report when only one column was present.
  if (idxCash < 0 && idxBonus < 0) return []

  const results: BoostRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || row.every(c => c == null || c === '')) continue

    // Skip footer summary rows — "Итого"/"Всего" can sit in the id, name, or
    // first column depending on layout.
    const idRaw   = idxCampaignId   >= 0 ? row[idxCampaignId]   : null
    const nameRaw = idxCampaignName >= 0 ? row[idxCampaignName] : null
    if ([idRaw, nameRaw, row[0]].some(v => {
      const s = String(v ?? '').trim()
      return s === 'Итого' || s === 'Итого:' || s === 'Всего'
    })) continue

    const cashSpend  = idxCash  >= 0 ? toNum(row[idxCash])  : 0
    const bonusSpend = idxBonus >= 0 ? toNum(row[idxBonus]) : 0
    // No spend at all → header echo / spacer / non-campaign row. Skip.
    if (cashSpend === 0 && bonusSpend === 0) continue

    // Date is optional: fall back to the report window's end date so real
    // spend is never dropped for lack of a per-row Дата cell.
    const date = (idxDate >= 0 ? toDateStr(row[idxDate]) : null) ?? fallbackDate ?? null
    if (!date) continue

    const campaignId = idRaw != null && idRaw !== ''
      ? (typeof idRaw === 'number' && Number.isFinite(idRaw) ? String(BigInt(Math.round(idRaw))) : String(idRaw).trim())
      : ''

    results.push({
      date,
      campaignId,
      campaignName: idxCampaignName >= 0 ? String(row[idxCampaignName] ?? '').trim() : '',
      impressions:  idxImpressions >= 0 ? Math.round(toNum(row[idxImpressions])) : 0,
      clicks:       idxClicks      >= 0 ? Math.round(toNum(row[idxClicks]))      : 0,
      cashSpend,
      bonusSpend,
    })
  }
  return results
}
