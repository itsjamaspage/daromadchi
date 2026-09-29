import type { IkpuResult } from './client'

const PROXY_URL = process.env.NEXT_PUBLIC_TASNIF_PROXY_URL ?? ''

interface RawSearchItem {
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

interface RawByParamsItem {
  mxikCode: string
  mxikName: string
  groupName: string
  className: string
  positionName: string
  subPositionName: string
  brandName: string
  unitName: string | null
}

function mapSearch(item: RawSearchItem): IkpuResult {
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

function mapByParams(item: RawByParamsItem): IkpuResult {
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

async function trySearch(
  baseUrl: string,
  query: string,
  lang: string,
  barcode: boolean,
  timeoutMs = 10_000,
): Promise<{ results: IkpuResult[]; total: number } | null> {
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    if (barcode) {
      const qs = new URLSearchParams({ gtin: query, lang, size: '20', page: '0' })
      const res = await fetch(`${baseUrl}/mxik/search/by-params?${qs}`, { signal })
      if (!res.ok) return null
      const body = await res.json()
      if (body.success && body.data?.content) {
        return { results: body.data.content.map(mapByParams), total: body.data.totalElements }
      }
      return { results: [], total: 0 }
    } else {
      const qs = new URLSearchParams({ search: query, lang, size: '20', page: '0' })
      const res = await fetch(`${baseUrl}/elasticsearch/search?${qs}`, { signal })
      if (!res.ok) return null
      const body = await res.json()
      if (body.success && body.data) {
        return { results: body.data.map(mapSearch), total: body.recordTotal }
      }
      return { results: [], total: 0 }
    }
  } catch {
    return null
  }
}

export async function searchIkpu(
  query: string,
  opts: { lang?: string; barcode?: boolean } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const barcode = opts.barcode ?? false

  // 1. Cloudflare Worker CORS proxy (primary — reliable, no geo-block)
  if (PROXY_URL) {
    const result = await trySearch(PROXY_URL, query, lang, barcode)
    if (result) return result
  }

  // 2. Direct browser → tasnif.soliq.uz (works if user is in UZ and CORS allows)
  const direct = await trySearch('https://tasnif.soliq.uz/api/cls-api', query, lang, barcode)
  if (direct) return direct

  // 3. Server rewrite proxy /_tasnif → tasnif.soliq.uz
  const proxy = await trySearch('/_tasnif', query, lang, barcode, 15_000)
  if (proxy) return proxy

  // 4. Server-side API route fallback
  const param = barcode
    ? `barcode=${encodeURIComponent(query)}`
    : `q=${encodeURIComponent(query)}`
  const res = await fetch(`/api/ikpu/search?${param}&lang=${lang}`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error('ikpu search failed')
  return res.json()
}
