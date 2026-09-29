import { Resolver } from 'node:dns/promises'
import * as https from 'node:https'

const HOST = 'tasnif.soliq.uz'
const BASE_PATH = '/api/cls-api'
const BASE = `https://${HOST}${BASE_PATH}`
const TIMEOUT_MS = 15_000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const FALLBACK_DNS = ['8.8.8.8', '1.1.1.1', '8.8.4.4']

const PROXY_URLS = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
]

let cachedIp: { ip: string; ts: number } | null = null
const IP_CACHE_TTL = 5 * 60_000

async function resolveHost(): Promise<string> {
  if (cachedIp && Date.now() - cachedIp.ts < IP_CACHE_TTL) return cachedIp.ip
  const resolver = new Resolver()
  resolver.setServers(FALLBACK_DNS)
  const addresses = await resolver.resolve4(HOST)
  cachedIp = { ip: addresses[0], ts: Date.now() }
  return addresses[0]
}

interface FetchLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

function httpsGet(ip: string, path: string, headers: Record<string, string>): Promise<FetchLike> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ip,
        port: 443,
        path,
        method: 'GET',
        headers: { ...headers, Host: HOST },
        servername: HOST,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          const status = res.statusCode ?? 0
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: () => Promise.resolve(JSON.parse(body)),
            text: () => Promise.resolve(body),
          })
        })
      },
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout after ${TIMEOUT_MS}ms`)) })
    req.on('error', reject)
    req.end()
  })
}

async function fetchViaProxy(targetUrl: string): Promise<FetchLike> {
  for (const proxy of PROXY_URLS) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      })
      if (res.ok) return res
    } catch {
      continue
    }
  }
  throw new Error('all proxy attempts failed for ' + targetUrl)
}

async function tasnifGet(path: string, headers: Record<string, string>): Promise<FetchLike> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
      headers,
    })
    return res
  } catch {
    // direct fetch failed
  }

  try {
    const ip = await resolveHost()
    return await httpsGet(ip, `${BASE_PATH}${path}`, headers)
  } catch {
    // direct HTTPS with DNS fallback also failed
  }

  return fetchViaProxy(`${BASE}${path}`)
}

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

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json',
  'User-Agent': UA,
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://tasnif.soliq.uz/',
  'Origin': 'https://tasnif.soliq.uz',
}

export async function searchByKeyword(
  keyword: string,
  opts: { lang?: string; size?: number; page?: number } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const size = opts.size ?? 20
  const page = opts.page ?? 0

  // 1. /mxik/search-subposition — classification-specific, most accurate (what tasnif.soliq.uz website uses)
  try {
    const qs = new URLSearchParams({ search_text: keyword, lang, size: String(size), page: String(page) })
    const res = await tasnifGet(`/mxik/search-subposition?${qs}`, COMMON_HEADERS)
    if (res.ok) {
      const body = (await res.json()) as ByParamsResponse
      if (body.success && body.data?.content?.length) {
        return { results: body.data.content.map(paramToResult), total: body.data.totalElements }
      }
    }
  } catch { /* fall through */ }

  // 2. /mxik/search/by-params?text= — structured text search
  try {
    const qs = new URLSearchParams({ text: keyword, lang, size: String(size), page: String(page) })
    const res = await tasnifGet(`/mxik/search/by-params?${qs}`, COMMON_HEADERS)
    if (res.ok) {
      const body = (await res.json()) as ByParamsResponse
      if (body.success && body.data?.content?.length) {
        return { results: body.data.content.map(paramToResult), total: body.data.totalElements }
      }
    }
  } catch { /* fall through */ }

  // 3. /elasticsearch/search — generic full-text fallback (less accurate)
  const qs = new URLSearchParams({ search: keyword, lang, size: String(size), page: String(page) })
  const res = await tasnifGet(`/elasticsearch/search?${qs}`, COMMON_HEADERS)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tasnif search failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const body = (await res.json()) as SearchResponse
  if (!body.success || !body.data) return { results: [], total: 0 }
  return { results: body.data.map(toResult), total: body.recordTotal }
}

export async function searchByBarcode(
  barcode: string,
  opts: { lang?: string; size?: number } = {},
): Promise<{ results: IkpuResult[]; total: number }> {
  const lang = opts.lang ?? 'ru'
  const size = opts.size ?? 20

  const qs = new URLSearchParams({ gtin: barcode, lang, size: String(size), page: '0' })
  const res = await tasnifGet(`/mxik/search/by-params?${qs}`, COMMON_HEADERS)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tasnif barcode search failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const body = (await res.json()) as ByParamsResponse
  if (!body.success || !body.data?.content) return { results: [], total: 0 }
  return { results: body.data.content.map(paramToResult), total: body.data.totalElements }
}
