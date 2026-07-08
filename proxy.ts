import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'

// ── CORS ──────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://www.daromadchi.uz',
  'https://daromadchi.uz',
  'http://localhost:3000',
]

// Extension routes intentionally allow cross-origin access from browser extensions.
const EXTENSION_ROUTE = /^\/api\/(ext\/|channel-check)/

function corsHeaders(origin: string | null, isExtRoute: boolean): Record<string, string> {
  if (isExtRoute) return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Vary': 'Origin' }
}

// ── CORS ──────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://www.daromadchi.uz',
  'https://daromadchi.uz',
  'http://localhost:3000',
]

// Extension routes intentionally allow cross-origin access from browser extensions.
const EXTENSION_ROUTE = /^\/api\/(ext\/|channel-check)/

function corsHeaders(origin: string | null, isExtRoute: boolean): Record<string, string> {
  if (isExtRoute) return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Vary': 'Origin' }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

interface RateEntry { count: number; resetAt: number }
const rateMap = new Map<string, RateEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateMap) {
    if (now > v.resetAt) rateMap.delete(k)
  }
}, 5 * 60 * 1000)

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function isRateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    if (rateMap.size > 10_000) {
      for (const [k, v] of rateMap) {
        if (now > v.resetAt) { rateMap.delete(k); break }
      }
    }
    return false
  }
  entry.count++
  return entry.count > limit
}

// ── Security headers ──────────────────────────────────────────────────────────

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')
  const isExtRoute = EXTENSION_ROUTE.test(pathname)

  if (pathname.startsWith('/api/')) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders(origin, isExtRoute) })
    }

    // CORS: reject non-whitelisted origins on non-extension routes
    if (!isExtRoute && origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const ip = getIp(request)

    // Rate limits (per spec):
    //   /api/sync/* and marketplace syncs — 10/min (keyed per IP, no per-user session available here)
    //   /api/auth/*                        — 20/min per IP
    //   all other /api/*                   — 100/min per IP
    const isSyncRoute = /^\/api\/(uzum|wildberries|yandex|cron)\/(sync|ads-sync)/.test(pathname)
    const isAuthRoute = pathname.startsWith('/api/auth/')
    const limit = isSyncRoute ? 10 : isAuthRoute ? 20 : 100

    if (isRateLimited(`${ip}:${pathname}`, limit)) {
      console.log(`[rate-limit] blocked ${ip} on ${pathname} at ${new Date().toISOString()}`)
      return addSecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: 'Too many requests', retryAfter: 60 }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders(origin, isExtRoute) } },
        )
      )
    }

    const res = NextResponse.next({ request })
    for (const [k, v] of Object.entries(corsHeaders(origin, isExtRoute))) res.headers.set(k, v)
    return addSecurityHeaders(res)
  }

  // Auth check for protected routes
  const publicRoutes = ['/', '/login', '/signup', '/about', '/pricing', '/sitemap.xml', '/robots.txt']
  const isPublic = publicRoutes.some(route => pathname === route || pathname.startsWith(route.endsWith('/') ? route : route + '/'))

  if (!isPublic && !pathname.startsWith('/_next') && !pathname.startsWith('/api/')) {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  const res = NextResponse.next({ request })
  addSecurityHeaders(res)
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
