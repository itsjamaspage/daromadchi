import type { IkpuResult } from './client'

const TASNIF_BASE = 'https://tasnif.soliq.uz/api/cls-api'

const CUSTOM_PROXY_URL = process.env.NEXT_PUBLIC_TASNIF_PROXY_URL ?? ''

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

function parseByParamsBody(
  body: Record<string, unknown>,
): { results: IkpuResult[]; total: number } | null {
  const data = body.data as { content?: RawByParamsItem[]; totalElements?: number } | undefined
  if (body.success && data?.content?.length) {
    return { results: data.content.map(mapByParams), total: data.totalElements ?? 0 }
  }
  return null
}

function parseElasticBody(
  body: Record<string, unknown>,
): { results: IkpuResult[]; total: number } | null {
  if (body.success && Array.isArray(body.data) && body.data.length) {
    return {
      results: (body.data as RawSearchItem[]).map(mapSearch),
      total: (body.recordTotal as number) ?? 0,
    }
  }
  return null
}

async function tryFetch(
  url: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (res.ok) return await res.json()
  } catch { /* swallow */ }
  return null
}

function subpositionUrl(query: string, lang: string): string {
  const qs = new URLSearchParams({ search_text: query, lang, size: '20', page: '0' })
  return `/mxik/search-subposition?${qs}`
}

function byParamsTextUrl(query: string, lang: string): string {
  const qs = new URLSearchParams({ text: query, lang, size: '20', page: '0' })
  return `/mxik/search/by-params?${qs}`
}

function byParamsBarcodeUrl(query: string, lang: string): string {
  const qs = new URLSearchParams({ gtin: query, lang, size: '20', page: '0' })
  return `/mxik/search/by-params?${qs}`
}

function elasticUrl(query: string, lang: string): string {
  const qs = new URLSearchParams({ search: query, lang, size: '20', page: '0' })
  return `/elasticsearch/search?${qs}`
}

async function searchDirect(
  query: string,
  lang: string,
  barcode: boolean,
  base: string,
  timeoutMs: number,
): Promise<{ results: IkpuResult[]; total: number } | null> {
  if (barcode) {
    const body = await tryFetch(`${base}${byParamsBarcodeUrl(query, lang)}`, timeoutMs)
    return body ? parseByParamsBody(body) : null
  }

  // Text search: try classification-specific endpoints first, then generic elasticsearch
  const body1 = await tryFetch(`${base}${subpositionUrl(query, lang)}`, timeoutMs)
  const parsed1 = body1 ? parseByParamsBody(body1) : null
  if (parsed1) return parsed1

  const body2 = await tryFetch(`${base}${byParamsTextUrl(query, lang)}`, timeoutMs)
  const parsed2 = body2 ? parseByParamsBody(body2) : null
  if (parsed2) return parsed2

  const body3 = await tryFetch(`${base}${elasticUrl(query, lang)}`, timeoutMs)
  return body3 ? parseElasticBody(body3) : null
}

export async function searchIkpu(
  query: string,
  opts: { lang?: string; barcode?: boolean } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const barcode = opts.barcode ?? false

  // 1. Custom proxy (self-hosted, if configured via NEXT_PUBLIC_TASNIF_PROXY_URL)
  if (CUSTOM_PROXY_URL) {
    const result = await searchDirect(query, lang, barcode, CUSTOM_PROXY_URL, 10_000)
    if (result) return result
  }

  // 2. Direct browser → tasnif.soliq.uz (fast when user is in UZ)
  const directResult = await searchDirect(query, lang, barcode, TASNIF_BASE, 5_000)
  if (directResult) return directResult

  // 3. Server-side API route (server proxies to tasnif internally, uses same endpoint chain)
  const param = barcode
    ? `barcode=${encodeURIComponent(query)}`
    : `q=${encodeURIComponent(query)}`
  const res = await fetch(`/api/ikpu/search?${param}&lang=${lang}`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error('ikpu search failed')
  return res.json()
}
