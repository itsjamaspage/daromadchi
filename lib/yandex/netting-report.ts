import * as XLSX from 'xlsx'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { YANDEX_API_BASE, YandexApiError } from './client'

// ─────────────────────────────────────────────────────────────────────────────
// Yandex Market — united netting report client.
//
// The netting report is Yandex's authoritative per-transaction record of
// every financial event tied to your orders (customer payment, delivery
// fee, commission, adjustments, etc.). Same data as the XLSX a seller
// can download by clicking "Выгрузить отчёт" in their cabinet's
// Finances tab.
//
// The API is asynchronous:
//   1. POST /reports/united-netting-report/generate   → returns reportId
//   2. GET  /reports/info/{reportId}                  → poll until DONE
//   3. GET  {file}                                    → downloads XLSX
//
// Parse the XLSX in Node with `xlsx` (already installed) and hand the
// rows back to the caller as SettlementTransaction[]. The caller
// (lib/yandex/settlements-sync.ts) upserts them into
// yandex_settlement_transactions.
// ─────────────────────────────────────────────────────────────────────────────

export interface SettlementTransaction {
  transactionId: string
  orderIdExternal: string | null
  entryType: string            // "Начисление" | "Удержание"
  entrySource: string | null   // "Платёж покупателя" | "Оплата услуг Market Yandex Go" | …
  orderType: string | null     // "Продажа физлицу" | "Доставка покупателю" | "Поручение на продажу"
  sku: string | null
  // «Название товара (к начислению) или услуги (к удержанию)» — the product name on
  // sale (Начисление) rows, a service name (commission/logistics) on fee (Удержание)
  // rows. Payouts uses it as the Yandex product name so a row reads exactly as the
  // seller's finance report prints it. Null when the column is absent/empty.
  productName: string | null
  amount: number               // signed — Начисление positive, Удержание negative
  quantity: number | null
  transactionAt: Date | null
  orderCreatedAt: Date | null
  orderDeliveredAt: Date | null
  statusNote: string | null
  // Payment-order («платежное поручение») columns. Present once Yandex has
  // TRANSFERRED the money on the payout schedule; null while it's only
  // «Будет переведён». statusNote «Переведён…» + a payment-order number is the
  // authoritative "paid" signal (see lib/db/payout-status.ts:isYandexTransferred).
  paymentOrderNumber: string | null
  paymentOrderDate: Date | null
}

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
    throw new YandexApiError(res.status, `Yandex API ${res.status} (${path})`, body)
  }
  return await res.json() as T
}

/**
 * Kick off report generation. Returns Yandex's reportId — poll it with
 * getReportStatus until DONE.
 *
 * Endpoint: POST /reports/united-netting/generate (verified via the
 * diagnose probe — the more-obvious /reports/united-netting-report/generate
 * returns 404). Body: { businessId, dateTimeFrom, dateTimeTo }.
 *
 * dateTimeTo MUST NOT be in the future (Yandex rejects with 400
 * "Right date bound (…) is in the future"), so we clamp it to `now`
 * regardless of what the caller passed.
 */
export async function generateNettingReport(
  token: string,
  businessId: number,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string,   // YYYY-MM-DD (upper bound, clamped to now)
): Promise<string> {
  interface GenerateResponse {
    result?: { reportId?: string; estimatedGenerationTime?: number }
    errors?: { code: string; message: string }[]
  }

  // Clamp the upper bound to just before "now" (subtract 60s so a
  // slight clock skew between us and Yandex can't still land in the
  // future). Preserves the requested dateFrom exactly.
  const now = new Date(Date.now() - 60_000)
  const requestedEndOfDay = new Date(`${dateTo}T23:59:59Z`)
  const upper = requestedEndOfDay > now ? now : requestedEndOfDay
  const dateTimeTo = upper.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const body = JSON.stringify({
    businessId,
    dateTimeFrom: `${dateFrom}T00:00:00Z`,
    dateTimeTo,
  })

  const data = await yandexRequest<GenerateResponse>(
    `/reports/united-netting/generate`,
    token,
    { method: 'POST', body },
  )
  const id = data.result?.reportId
  if (!id) {
    throw new Error(`Yandex report generate returned no reportId. Body: ${JSON.stringify(data).slice(0, 400)}`)
  }
  return id
}

export interface ReportStatus {
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'NO_DATA'
  fileUrl: string | null
  raw: unknown
}

/** Single status check. */
export async function getReportStatus(token: string, reportId: string): Promise<ReportStatus> {
  interface StatusResponse {
    result?: { status?: string; file?: string; subStatus?: string }
    errors?: { code: string; message: string }[]
  }
  const data = await yandexRequest<StatusResponse>(`/reports/info/${reportId}`, token)
  const status = (data.result?.status as ReportStatus['status']) ?? 'PENDING'
  return { status, fileUrl: data.result?.file ?? null, raw: data }
}

/**
 * Poll until DONE (or FAILED / NO_DATA / timeout). Yandex typically finishes
 * in 30s–5min for a month of data. We poll every 5s up to `timeoutMs`.
 */
export async function pollReportUntilReady(
  token: string,
  reportId: string,
  timeoutMs = 15 * 60 * 1000,
): Promise<ReportStatus> {
  const start = Date.now()
  while (true) {
    const s = await getReportStatus(token, reportId)
    if (s.status === 'DONE' || s.status === 'FAILED' || s.status === 'NO_DATA') return s
    if (Date.now() - start > timeoutMs) return s // return whatever the last status was
    await new Promise(r => setTimeout(r, 5000))
  }
}

/** Download the report file at the URL Yandex gave us. */
export async function downloadReport(url: string, token: string): Promise<ArrayBuffer> {
  // The file URL from getReportStatus may or may not require the Api-Key
  // header depending on Yandex's CDN config. Send it either way — extra
  // headers are ignored when not needed.
  const res = await marketplaceFetch(url, {
    headers: { 'Api-Key': token, Accept: '*/*' },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new YandexApiError(res.status, `Yandex report download failed ${res.status}`, `URL: ${url}`)
  }
  return await res.arrayBuffer()
}

/**
 * Snapshot of what a downloaded XLSX actually contains — used when the parser
 * finds zero transactions and we need to see whether the layout drifted from
 * the sample we built against. Returned by describeNettingReport and surfaced
 * in the sync's error `debug` field on parse-miss.
 */
export interface NettingReportShape {
  sheets: {
    name: string
    rowCount: number
    firstRows: unknown[][] // first 3 non-empty rows for visual inspection
  }[]
}

export function describeNettingReport(buffer: ArrayBuffer): NettingReportShape {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheets = wb.SheetNames.map(name => {
    const s = wb.Sheets[name]
    const rows: unknown[][] = s ? XLSX.utils.sheet_to_json(s, { header: 1, raw: true, defval: null }) : []
    const nonEmpty = rows.filter(r => Array.isArray(r) && r.some(c => c != null && c !== ''))
    return {
      name,
      rowCount: rows.length,
      // Show every column (no truncation to N cells) — Yandex added new
      // financial columns beyond col 19 in a schema change and we could
      // not see them. Cell values still trimmed to 60 chars so the blob
      // stays readable.
      firstRows: nonEmpty.slice(0, 3).map(r => r.map(c =>
        typeof c === 'string' && c.length > 60 ? c.slice(0, 60) + '…' : c,
      )),
    }
  })
  return { sheets }
}

// Yandex tweaks column labels between report versions ("Сумма транзакции, UZS"
// vs "Сумма транзакции" vs the ,-UZS variant). Match by any of a list of
// candidates, whitespace/case-insensitive.
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

/**
 * Parse the XLSX buffer Yandex returned. Structure (verified against a real
 * report from a Uzbek FBS seller):
 *   Sheet 1: business summary (skipped)
 *   Sheet 2: one row per transaction with header row followed by data rows
 *            (with the columns documented in migrations/035_yandex_settlements.sql).
 * We scan every sheet for the header row so a layout drift (Yandex adding a
 * new intro sheet, splitting into per-order-type sheets, …) doesn't zero the
 * parse. Header lookup itself is case/whitespace-insensitive with synonyms.
 */
export function parseNettingReport(buffer: ArrayBuffer): SettlementTransaction[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  let sheet: XLSX.WorkSheet | undefined
  let rows: unknown[][] = []
  let headerIdx = -1
  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name]
    if (!s) continue
    const r: unknown[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: true, defval: null })
    const idx = r.findIndex(row => Array.isArray(row) && row.some(c => normHeader(c) === 'id транзакции' || normHeader(c).startsWith('id транзакции')))
    if (idx >= 0) { sheet = s; rows = r; headerIdx = idx; break }
  }
  if (!sheet || headerIdx < 0) return []
  const header = rows[headerIdx] as (string | null)[]

  const idxTransactionId       = findCol(header, ['ID транзакции'])
  const idxTransactionDate     = findCol(header, ['Дата транзакции'])
  const idxOrderIdExternal     = findCol(header, ['Ваш номер заказа'])
  const idxYandexOrderNum      = findCol(header, ['Номер заказа или отгрузки', 'Номер заказа', 'Номер отгрузки'])
  const idxOrderCreatedAt      = findCol(header, ['Дата создания заказа'])
  const idxOrderDeliveredAt    = findCol(header, ['Дата доставки заказа'])
  const idxOrderType           = findCol(header, ['Тип заказа'])
  const idxSku                 = findCol(header, ['Ваш SKU', 'SKU'])
  const idxProductName         = findCol(header, ['Название товара (к начислению) или услуги (к удержанию)', 'Название товара', 'Наименование товара'])
  const idxAmount              = findCol(header, ['Сумма транзакции, UZS', 'Сумма транзакции'])
  const idxEntryType           = findCol(header, ['Тип транзакции'])
  const idxEntrySource         = findCol(header, ['Источник транзакции'])
  const idxQty                 = findCol(header, ['Количество'])
  const idxStatusNote          = findCol(header, ['Статус'])
  // Payment-order columns — the authoritative "transferred" signal. Yandex has
  // used a few label variants across report versions; match any.
  const idxPayOrderNum         = findCol(header, ['Номер платежного поручения', 'Номер платёжного поручения', '№ платежного поручения'])
  const idxPayOrderDate        = findCol(header, ['Дата платежного поручения', 'Дата платёжного поручения'])

  // If we can't find the two columns that decide "is this a real
  // financial event" — amount and entry type — the sheet is not the
  // netting report we expect. Bail out rather than emit garbage.
  if (idxAmount < 0 || idxEntryType < 0) return []

  const results: SettlementTransaction[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || row.every(c => c == null || c === '')) continue

    // Skip footer "Итого" summary rows.
    const entryType = String(row[idxEntryType] ?? '').trim()
    if (!entryType || entryType === 'Итого' || entryType === 'Итого:') continue

    // Yandex's newest layout leaves "ID транзакции" NULL until the
    // payment actually posts — the row still carries a real amount +
    // entry type + source, so we can't just skip it. Synthesize a
    // stable, deterministic key from the immutable event fields so
    // upserts hit the same row on every re-sync, and switch to Yandex's
    // real ID automatically once it appears (the natural key changes).
    const txnIdRaw = idxTransactionId >= 0 ? row[idxTransactionId] : null
    let transactionId: string
    if (txnIdRaw != null && txnIdRaw !== '') {
      // xlsx may parse large IDs as numbers in scientific notation —
      // normalize to a plain string via BigInt when it's an integer.
      transactionId = typeof txnIdRaw === 'number' && Number.isFinite(txnIdRaw)
        ? String(BigInt(Math.round(txnIdRaw)))
        : String(txnIdRaw).trim()
    } else {
      const orderNumRaw = idxYandexOrderNum >= 0 ? row[idxYandexOrderNum] : null
      const orderNum = orderNumRaw != null
        ? (typeof orderNumRaw === 'number' && Number.isFinite(orderNumRaw) ? String(BigInt(Math.round(orderNumRaw))) : String(orderNumRaw).trim())
        : 'noorder'
      const txDate = idxTransactionDate >= 0 ? row[idxTransactionDate] : null
      const txDateKey = txDate instanceof Date ? txDate.toISOString() : String(txDate ?? '')
      const src = idxEntrySource >= 0 ? String(row[idxEntrySource] ?? '') : ''
      const amt = row[idxAmount]
      transactionId = `synth:${orderNum}:${txDateKey}:${entryType}:${src}:${amt}`
    }

    const amountRaw = row[idxAmount]
    const amount = typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw ?? '0').replace(',', '.'))

    // "Ваш номер заказа" is the seller's own number; if empty, fall back
    // to the Yandex-side "Номер заказа или отгрузки".
    let orderIdExternal: string | null = null
    for (const idx of [idxOrderIdExternal, idxYandexOrderNum]) {
      if (idx < 0) continue
      const raw = row[idx]
      if (raw == null || raw === '') continue
      orderIdExternal = typeof raw === 'number' && Number.isFinite(raw)
        ? String(BigInt(Math.round(raw)))
        : String(raw).trim()
      break
    }

    const toDate = (v: unknown): Date | null => {
      if (v instanceof Date) return v
      if (typeof v === 'string' && v.trim()) {
        // Yandex uses "dd.MM.yyyy HH:mm" — Date can't parse that directly.
        const m = v.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
        if (m) {
          const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = m
          return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss))
        }
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d
      }
      return null
    }

    results.push({
      transactionId,
      orderIdExternal,
      entryType,
      entrySource:       idxEntrySource >= 0 ? String(row[idxEntrySource] ?? '').trim() || null : null,
      orderType:         idxOrderType   >= 0 ? String(row[idxOrderType]   ?? '').trim() || null : null,
      sku:               idxSku         >= 0 ? String(row[idxSku]         ?? '').trim() || null : null,
      productName:       idxProductName >= 0 ? String(row[idxProductName] ?? '').trim() || null : null,
      amount:            Number.isFinite(amount) ? amount : 0,
      quantity:          idxQty >= 0 && row[idxQty] != null ? Math.round(Number(row[idxQty])) : null,
      transactionAt:     idxTransactionDate  >= 0 ? toDate(row[idxTransactionDate])  : null,
      orderCreatedAt:    idxOrderCreatedAt   >= 0 ? toDate(row[idxOrderCreatedAt])   : null,
      orderDeliveredAt:  idxOrderDeliveredAt >= 0 ? toDate(row[idxOrderDeliveredAt]) : null,
      statusNote:        idxStatusNote       >= 0 ? String(row[idxStatusNote] ?? '').trim() || null : null,
      // xlsx may parse a numeric п/п as a number — normalize to a plain string.
      paymentOrderNumber: idxPayOrderNum >= 0 && row[idxPayOrderNum] != null && row[idxPayOrderNum] !== ''
        ? (typeof row[idxPayOrderNum] === 'number' && Number.isFinite(row[idxPayOrderNum] as number)
            ? String(BigInt(Math.round(row[idxPayOrderNum] as number)))
            : String(row[idxPayOrderNum]).trim() || null)
        : null,
      paymentOrderDate:  idxPayOrderDate >= 0 ? toDate(row[idxPayOrderDate]) : null,
    })
  }
  return results
}
