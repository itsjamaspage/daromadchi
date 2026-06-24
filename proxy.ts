import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

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

function isRateLimited(ip: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs })
    if (rateMap.size > 5000) {
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

  if (pathname.startsWith('/api/')) {
    if (!pathname.startsWith('/api/auth/')) {
      const ip = getIp(request)
      const isSyncRoute = /^\/api\/(uzum|wildberries|yandex)\/sync/.test(pathname)
      const isSensitive = /^\/api\/(auth\/signup|feedback)/.test(pathname)
      const limit = isSyncRoute || isSensitive ? 20 : 60

      if (isRateLimited(ip, limit)) {
        console.log(`[rate-limit] blocked ${ip} on ${pathname} at ${new Date().toISOString()}`)
        return addSecurityHeaders(
          new NextResponse(
            JSON.stringify({ error: 'Too many requests', retryAfter: 60 }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
          )
        )
      }
    }

    return addSecurityHeaders(NextResponse.next({ request }))
  }

  const res = await updateSession(request)
  addSecurityHeaders(res)
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
