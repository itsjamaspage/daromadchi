import type { IkpuResult } from './client'

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

export async function searchIkpu(
  query: string,
  opts: { lang?: string; barcode?: boolean } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const signal = AbortSignal.timeout(15_000)

  // Try edge rewrite proxy (/_tasnif → tasnif.soliq.uz via Vercel edge)
  try {
    if (opts.barcode) {
      const qs = new URLSearchParams({ gtin: query, lang, size: '20', page: '0' })
      const res = await fetch(`/_tasnif/mxik/search/by-params?${qs}`, { signal })
      if (res.ok) {
        const body = await res.json()
        if (body.success && body.data?.content) {
          return { results: body.data.content.map(mapByParams), total: body.data.totalElements }
        }
        return { results: [], total: 0 }
      }
    } else {
      const qs = new URLSearchParams({ search: query, lang, size: '20', page: '0' })
      const res = await fetch(`/_tasnif/elasticsearch/search?${qs}`, { signal })
      if (res.ok) {
        const body = await res.json()
        if (body.success && body.data) {
          return { results: body.data.map(mapSearch), total: body.recordTotal }
        }
        return { results: [], total: 0 }
      }
    }
  } catch {
    // Edge proxy failed, try server-side API route fallback
  }

  // Fallback: server-side API route (Lambda → tasnif)
  const param = opts.barcode
    ? `barcode=${encodeURIComponent(query)}`
    : `q=${encodeURIComponent(query)}`
  const res = await fetch(`/api/ikpu/search?${param}&lang=${lang}`, { signal })
  if (!res.ok) throw new Error('ikpu search failed')
  return res.json()
}
