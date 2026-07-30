import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getRealRatesBySku } from '@/lib/db/real-financials'

export const runtime = 'nodejs'

// Public-to-the-extension endpoint. Returns the seller's REAL commission
// and delivery percentages for a given SKU + marketplace, derived from
// their own settlement history. Extension calls this before rendering
// the "Add to Unit Economics" widget so the numbers shown on the WB /
// Uzum / Yandex product page match what the marketplace actually
// charged this seller for that exact SKU.
//
// Auth: the browser sends daromadchi.uz's own session cookie because
// the extension has host_permissions for our domain. If the seller
// isn't logged in, we return hasReal:false without leaking anything.
//
// CORS: browser extensions have origins like chrome-extension://<id>.
// We echo back whatever origin the request came from as long as it's
// a chrome-extension:// scheme (or our own domain), and always allow
// credentials so the session cookie flows.

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://') ||
    origin.endsWith('daromadchi.uz')
  )
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin':      origin!,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
    'Vary':                             'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'))
  const sku = req.nextUrl.searchParams.get('sku')?.trim()
  const mp  = req.nextUrl.searchParams.get('marketplace')?.trim()
  if (!sku || !mp) {
    return NextResponse.json({ ok: false, error: 'sku and marketplace required' }, { status: 400, headers })
  }

  const user = await getCurrentUser()
  if (!user) {
    // Return "no real data" instead of 401 so the extension gracefully
    // falls back to defaults for unauthenticated users without a red
    // console error every time.
    return NextResponse.json({ ok: true, hasReal: false, reason: 'unauthenticated' }, { headers })
  }

  const map = await getRealRatesBySku(user.id)
  const rate = map.get(sku)
  // Normalize marketplace: the extension may send 'wb' (short) or
  // 'wildberries' (full). Accept both.
  const normalized = mp === 'wb' ? 'wildberries' : mp === 'yandex' ? 'yandex_market' : mp
  if (!rate || rate.marketplace !== normalized) {
    return NextResponse.json({ ok: true, hasReal: false, sku, marketplace: normalized }, { headers })
  }
  return NextResponse.json({
    ok: true,
    hasReal: true,
    sku,
    marketplace: rate.marketplace,
    commissionPct: Math.round(rate.commissionPct * 100) / 100,
    deliveryPct:   Math.round(rate.deliveryPct   * 100) / 100,
    itemCount:     rate.itemCount,
    windowSince:   rate.windowSince,
  }, { headers })
}
