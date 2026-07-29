// In-memory per-IP rate limiter. Single-node app — no Redis/Upstash needed
// yet. Uses a fixed-window counter per key; buckets are pruned lazily and
// on interval to keep the map bounded.
//
// Not a defense against a distributed attack from thousands of IPs (nothing
// short of Cloudflare handles that), but stops the "one script hammering
// signup" scenario the audit flagged as the real risk.
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface Bucket {
  count:     number
  expiresAt: number
}

const buckets = new Map<string, Bucket>()

// Prune once a minute so an idle process doesn't leak memory over weeks.
let sweeperInstalled = false
function installSweeper() {
  if (sweeperInstalled) return
  sweeperInstalled = true
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of buckets) if (v.expiresAt <= now) buckets.delete(k)
  }, 60_000).unref?.()
}

export function ipOf(req: NextRequest): string {
  // Trust standard proxy headers set by our nginx/cloud LB. Fall back to a
  // literal string so an unlabelled bucket exists (rare — behind our LB
  // every request has x-forwarded-for).
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

interface CheckOpts {
  key:        string   // stable identifier for the endpoint, e.g. 'auth:signup'
  ip:         string   // caller IP from ipOf(req)
  max:        number   // requests allowed per window
  windowMs:   number   // window length in milliseconds
}

interface CheckResult {
  ok:          boolean
  remaining:   number
  retryAfter:  number  // seconds until the window resets (only meaningful when !ok)
}

export function checkLimit({ key, ip, max, windowMs }: CheckOpts): CheckResult {
  installSweeper()
  const now      = Date.now()
  const bucketId = `${key}:${ip}`
  const existing = buckets.get(bucketId)

  if (!existing || existing.expiresAt <= now) {
    buckets.set(bucketId, { count: 1, expiresAt: now + windowMs })
    return { ok: true, remaining: max - 1, retryAfter: 0 }
  }
  if (existing.count >= max) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((existing.expiresAt - now) / 1000) }
  }
  existing.count += 1
  return { ok: true, remaining: max - existing.count, retryAfter: 0 }
}

// Convenience: check + return a 429 response ready to throw from a handler.
// Returns null when allowed, or a NextResponse when the caller should return.
export function enforceLimit(req: NextRequest, opts: Omit<CheckOpts, 'ip'>): NextResponse | null {
  const ip = ipOf(req)
  const r  = checkLimit({ ...opts, ip })
  if (r.ok) return null
  return NextResponse.json(
    { ok: false, error: 'too_many_requests', retryAfter: r.retryAfter },
    { status: 429, headers: { 'Retry-After': String(r.retryAfter) } },
  )
}
