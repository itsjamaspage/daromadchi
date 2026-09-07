import type { IkpuResult } from './client'

const BASE = 'https://tasnif.soliq.uz/api/cls-api'
const TIMEOUT_MS = 15_000

interface SearchItem {
  mxikCode: string
  name: string
  fullName: string
  groupName: string
  className: string
  positionName: string
  subPositionName: string
  brandName: string | null
  unitsName: string
}

interface SearchResponse {
  success: boolean
  code: number
  data: SearchItem[] | null
  recordTotal: number
}

interface ByParamsItem {
  mxikCode: string
  mxikName: string
  groupName: string
  className: string
  positionName: string
  subPositionName: string
  brandName: string
  unitName: string | null
}

interface ByParamsResponse {
  success: boolean
  code: number
  data: {
    content: ByParamsItem[] | null
    totalElements: number
  }
}

function toResult(item: SearchItem): IkpuResult {
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

export async function searchDirect(
  q: string,
  opts: { lang?: string; barcode?: boolean } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'

  if (opts.barcode) {
    const qs = new URLSearchParams({ gtin: q, lang, size: '20', page: '0' })
    const res = await fetch(`${BASE}/mxik/search/by-params?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`tasnif barcode: ${res.status}`)
    const body: ByParamsResponse = await res.json()
    if (!body.success || !body.data?.content) return { results: [], total: 0 }
    return { results: body.data.content.map(paramToResult), total: body.data.totalElements }
  }

  const qs = new URLSearchParams({ search: q, lang, size: '20', page: '0' })
  const res = await fetch(`${BASE}/elasticsearch/search?${qs}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`tasnif search: ${res.status}`)
  const body: SearchResponse = await res.json()
  if (!body.success || !body.data) return { results: [], total: 0 }
  return { results: body.data.map(toResult), total: body.recordTotal }
}
