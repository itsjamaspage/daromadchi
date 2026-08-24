/**
 * Belt-and-braces sign-out: expire the session cookie under every scope it
 * could have been written with, not just the one currently configured.
 *
 * Auth.js's own signOut() runs first (client side, so its session events and
 * CSRF handling are untouched); this route then sweeps up any same-named
 * cookie left at another scope. See lib/auth/cookie-sweep.ts for why one
 * browser can hold two.
 *
 * Idempotent and safe to call when already signed out — expiring a cookie that
 * is not there does nothing. It deliberately does NOT read or require a
 * session: a user whose session is half-broken is exactly who needs this, and
 * refusing them would be the wrong failure. Nothing is read from the request
 * body and nothing is written to the database, so there is no state to abuse:
 * the only effect is clearing the caller's own cookies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { expiredCookieHeaders } from '@/lib/auth/cookie-sweep'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  for (const value of expiredCookieHeaders(req.headers.get('host'))) {
    res.headers.append('Set-Cookie', value)
  }
  // Never let an intermediary serve a cached "you are signed out" response, or
  // reuse this one for another user.
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}
