import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ALLOWED_HOSTS = ['i.ibb.co', 'ibb.co']
const CACHE_SECONDS = 86400 * 30 // 30 days

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

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
    },
  })

  if (!res.ok) {
    return new NextResponse(null, { status: res.status })
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const body = await res.arrayBuffer()

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
      'CDN-Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  })
}
