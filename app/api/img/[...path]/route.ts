import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ALLOWED_HOSTS = ['i.ibb.co', 'ibb.co']
const CACHE_SECONDS = 86400 * 30 // 30 days
const MAX_RETRIES = 3

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
}

const imgCache = new Map<string, { contentType: string; body: ArrayBuffer; ts: number }>()
const MAX_CACHE = 200
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

const inflightRequests = new Map<string, Promise<{ contentType: string; body: ArrayBuffer } | null>>()

function evictStale() {
  const now = Date.now()
  for (const [key, entry] of imgCache) {
    if (now - entry.ts > CACHE_TTL_MS) imgCache.delete(key)
  }
  if (imgCache.size > MAX_CACHE) {
    const oldest = [...imgCache.entries()].sort((a, b) => a[1].ts - b[1].ts)
    for (let i = 0; i < oldest.length - MAX_CACHE; i++) imgCache.delete(oldest[i][0])
  }
}

async function fetchImage(url: string): Promise<{ contentType: string; body: ArrayBuffer } | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? 'image/jpeg'
      const body = await res.arrayBuffer()
      return { contentType, body }
    }
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    }
    return null
  }
  return null
}

async function getImage(url: string): Promise<{ contentType: string; body: ArrayBuffer } | null> {
  const cached = imgCache.get(url)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { contentType: cached.contentType, body: cached.body }
  }

  const inflight = inflightRequests.get(url)
  if (inflight) return inflight

  const promise = fetchImage(url).then(result => {
    inflightRequests.delete(url)
    if (result) {
      evictStale()
      imgCache.set(url, { ...result, ts: Date.now() })
    }
    return result
  })
  inflightRequests.set(url, promise)
  return promise
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const imgPath = path.join('/')

  const url = `https://i.ibb.co/${imgPath}`

  const parsed = new URL(url)
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: 'Forbidden host' }, { status: 403 })
  }

  const result = await getImage(url)

  if (!result) {
    return new NextResponse(null, { status: 502 })
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Content-Length': String(result.body.byteLength),
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
      'CDN-Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  })
}
