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

/**
 * Parse the boost-consolidated XLSX. The relevant sheet is "Отчёт по
 * кампаниям"; the header row is NOT row 0, so we scan every sheet's rows for
 * the header row that carries an 'ID кампании' cell (same scan-for-header
 * pattern parseNettingReport uses). If the header or the two spend columns are
 * missing, return [] so the caller can fall back to a shape snapshot.
 */
export function parseBoostReport(buffer: ArrayBuffer): BoostRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  let rows: unknown[][] = []
  let headerIdx = -1
  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name]
    if (!s) continue
    const r: unknown[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: true, defval: null })
    const idx = r.findIndex(row =>
      Array.isArray(row) && row.some(c => normHeader(c) === 'id кампании' || normHeader(c).startsWith('id кампании')))
    if (idx >= 0) { rows = r; headerIdx = idx; break }
  }
  if (headerIdx < 0) return []
  const header = rows[headerIdx] as (string | null)[]

  const idxDate         = findCol(header, ['Дата'])
  const idxCampaignId   = findCol(header, ['ID кампании'])
  const idxCampaignName = findCol(header, ['Название кампании'])
  const idxImpressions  = findCol(header, ['Показы, шт.', 'Показы'])
  const idxClicks       = findCol(header, ['Клики, шт.', 'Клики'])
  const idxCash         = findCol(header, ['Фактические расходы, сум', 'Фактические расходы'])
  const idxBonus        = findCol(header, ['Списано бонусов'])

  // Without both spend columns this isn't the boost report we expect.
  if (idxCash < 0 || idxBonus < 0) return []

  const results: BoostRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || row.every(c => c == null || c === '')) continue

    // Skip footer "Итого" summary rows.
    const idRaw = idxCampaignId >= 0 ? row[idxCampaignId] : null
    const first = String(idRaw ?? '').trim()
    if (first === 'Итого' || first === 'Итого:') continue

    const date = idxDate >= 0 ? toDateStr(row[idxDate]) : null
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
      cashSpend:    toNum(row[idxCash]),
      bonusSpend:   toNum(row[idxBonus]),
    })
  }
  return results
}
