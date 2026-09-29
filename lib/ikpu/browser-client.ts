import type { IkpuResult } from './client'

const TASNIF_BASE = 'https://tasnif.soliq.uz/api/cls-api'

const CUSTOM_PROXY_URL = process.env.NEXT_PUBLIC_TASNIF_PROXY_URL ?? ''

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

function buildTargetUrl(query: string, lang: string, barcode: boolean): string {
  if (barcode) {
    const qs = new URLSearchParams({ gtin: query, lang, size: '20', page: '0' })
    return `${TASNIF_BASE}/mxik/search/by-params?${qs}`
  }
  const qs = new URLSearchParams({ search: query, lang, size: '20', page: '0' })
  return `${TASNIF_BASE}/elasticsearch/search?${qs}`
}

function parseResponse(
  body: Record<string, unknown>,
  barcode: boolean,
): { results: IkpuResult[]; total: number } | null {
  if (barcode) {
    const data = body.data as { content?: RawByParamsItem[]; totalElements?: number } | undefined
    if (body.success && data?.content) {
      return { results: data.content.map(mapByParams), total: data.totalElements ?? 0 }
    }
  } else {
    if (body.success && body.data) {
      return {
        results: (body.data as RawSearchItem[]).map(mapSearch),
        total: (body.recordTotal as number) ?? 0,
      }
    }
  }
  return null
}

export async function searchIkpu(
  query: string,
  opts: { lang?: string; barcode?: boolean } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const barcode = opts.barcode ?? false
  const targetUrl = buildTargetUrl(query, lang, barcode)

  // 1. Custom proxy (self-hosted, if configured via NEXT_PUBLIC_TASNIF_PROXY_URL)
  if (CUSTOM_PROXY_URL) {
    try {
      const path = barcode
        ? `/mxik/search/by-params?${new URLSearchParams({ gtin: query, lang, size: '20', page: '0' })}`
        : `/elasticsearch/search?${new URLSearchParams({ search: query, lang, size: '20', page: '0' })}`
      const res = await fetch(`${CUSTOM_PROXY_URL}${path}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const body = await res.json()
        const parsed = parseResponse(body, barcode)
        if (parsed) return parsed
      }
    } catch {
      // fall through
    }
  }

  // 2. Direct browser → tasnif.soliq.uz (fast when user is in UZ)
  try {
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(5_000) })
    if (res.ok) {
      const body = await res.json()
      const parsed = parseResponse(body, barcode)
      if (parsed) return parsed
    }
  } catch {
    // CORS-blocked or geo-blocked, fall through
  }

  // 3. Server-side API route (server proxies to tasnif internally)
  const param = barcode
    ? `barcode=${encodeURIComponent(query)}`
    : `q=${encodeURIComponent(query)}`
  const res = await fetch(`/api/ikpu/search?${param}&lang=${lang}`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error('ikpu search failed')
  return res.json()
}
