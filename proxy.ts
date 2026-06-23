import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// In-memory rate limiter (per serverless instance — basic DDoS protection)
const rateMap = new Map<string, { count: number; resetAt: number }>()

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
    // Evict a few stale entries to prevent unbounded growth
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    const ip = getIp(request)
    // Sync routes: 20/min; auth/feedback: 20/min; others: 100/min
    const isSyncRoute    = /^\/api\/(uzum|wildberries|yandex)\/sync/.test(pathname)
    const isSensitive    = /^\/api\/(auth\/signup|feedback)/.test(pathname)
    const limit = (isSyncRoute || isSensitive) ? 20 : 100
    if (isRateLimited(ip, limit)) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: 'Too many requests' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      )
    }
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
