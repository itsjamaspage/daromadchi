const BASE = 'https://tasnif.soliq.uz/api/cls-api'
const TIMEOUT_MS = 15_000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

export interface IkpuSearchItem {
  mxikCode: string
  name: string
  description: string
  internationalCode: string | null
  label: string
  fullName: string
  groupCode: string
  groupName: string
  classCode: string
  className: string
  positionCode: string
  positionName: string
  subPositionCode: string
  subPositionName: string
  brandCode: string
  brandName: string | null
  attributeName: string | null
  unitsName: string
  categoryCode: string
  categoryName: string
  packageName: string | null
  usePackage: string
}

interface SearchResponse {
  success: boolean
  code: number
  reason: string
  data: IkpuSearchItem[] | null
  recordTotal: number
  errors: unknown
}

interface ByParamsItem {
  mxikCode: string
  mxikName: string
  groupName: string
  className: string
  positionName: string
  subPositionName: string
  brandName: string
  attributeName: string
  unitCode: string | null
  unitName: string | null
  internationalCode: string
  label: number
}

interface ByParamsResponse {
  success: boolean
  code: number
  reason: string
  data: {
    content: ByParamsItem[] | null
    totalElements: number
    totalPages: number
  }
  errors: unknown
}

export type IkpuResult = {
  mxikCode: string
  name: string
  groupName: string
  className: string
  positionName: string
  subPositionName: string
  brandName: string | null
  unitName: string | null
}

function toResult(item: IkpuSearchItem): IkpuResult {
  return {
    mxikCode: item.mxikCode,
    name: item.name || item.fullName,
    groupName: item.groupName,
    className: item.className,
    positionName: item.positionName,
    subPositionName: item.subPositionName,
    brandName: item.brandName,
    unitName: item.unitsName || null,
  }
}

function paramToResult(item: ByParamsItem): IkpuResult {
  return {
    mxikCode: item.mxikCode,
    name: item.mxikName,
    groupName: item.groupName,
    className: item.className,
    positionName: item.positionName,
    subPositionName: item.subPositionName,
    brandName: item.brandName || null,
    unitName: item.unitName,
  }
}

export async function searchByKeyword(
  keyword: string,
  opts: { lang?: string; size?: number; page?: number } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const size = opts.size ?? 20
  const page = opts.page ?? 0

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': UA,
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://tasnif.soliq.uz/',
    'Origin': 'https://tasnif.soliq.uz',
  }

  const qs = new URLSearchParams({ search: keyword, lang, size: String(size), page: String(page) })
  let res: Response
  try {
    res = await fetch(`${BASE}/elasticsearch/search?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
      headers,
    })
  } catch {
    res = await fetch(`${BASE}/elasticsearch/search`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: keyword, lang, size, page }),
    })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tasnif search failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const body: SearchResponse = await res.json()
  if (!body.success || !body.data) return { results: [], total: 0 }
  return { results: body.data.map(toResult), total: body.recordTotal }
}

export async function searchByBarcode(
  barcode: string,
  opts: { lang?: string; size?: number } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const size = opts.size ?? 20

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': UA,
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://tasnif.soliq.uz/',
    'Origin': 'https://tasnif.soliq.uz',
  }

  const qs = new URLSearchParams({ gtin: barcode, lang, size: String(size), page: '0' })
  const res = await fetch(`${BASE}/mxik/search/by-params?${qs}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
    headers,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tasnif barcode search failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const body: ByParamsResponse = await res.json()
  if (!body.success || !body.data?.content) return { results: [], total: 0 }
  return { results: body.data.content.map(paramToResult), total: body.data.totalElements }
}
