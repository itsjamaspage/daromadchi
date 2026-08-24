import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { YANDEX_API_BASE } from '@/lib/yandex/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 60

// READ-ONLY diagnostic. Calls Yandex Market's real API for the current
// user's YM campaign and returns the raw response so the seller can
// verify what Yandex actually sends as commissionTotal / deliveryTotal /
// buyerTotal per order.
//
// Usage:
//   GET /api/yandex/diagnose?orderId=<yandex order id>   → single order
//   GET /api/yandex/diagnose                             → latest 10 orders
//
// Auth: the current user must have a connected Yandex Market shop.

interface Probe {
  label: string
  url: string
  ok: boolean
  status: number
  bodySnippet: string
  parsed: unknown
}

async function probe(label: string, url: string, token: string): Promise<Probe> {
  try {
    // Yandex Partner API auth header is `Api-Key: <token>`, NOT Bearer.
    // Using Bearer returns 401 which our sandboxed error wrapper turned
    // into a 500 in the previous version of this file.
    const res = await marketplaceFetch(url, {
      headers: { 'Api-Key': token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const text = await res.text().catch(() => '')
    let parsed: unknown = null
    try { parsed = JSON.parse(text) } catch { /* not json */ }
    return {
      label,
      url: url.replace(YANDEX_API_BASE, ''),
      ok: res.ok,
      status: res.status,
      bodySnippet: text.slice(0, 800),
      parsed,
    }
  } catch (e) {
    return {
      label,
      url: url.replace(YANDEX_API_BASE, ''),
      ok: false,
      status: 0,
      bodySnippet: e instanceof Error ? e.message : String(e),
      parsed: null,
    }
  }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const orderId = req.nextUrl.searchParams.get('orderId')

  // Find the user's Yandex shop (any of them if multiple).
  const ymShops = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
    business_id: shops.business_id,
  // Diagnostics intentionally include DEACTIVATED shops — this endpoint exists to
  // explain a shop's state, and hiding a disconnected one would hide the answer.
  }).from(shops).where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'yandex_market')))

  if (ymShops.length === 0) {
    return NextResponse.json({ ok: false, error: 'No Yandex Market shop connected for this user.' }, { status: 404 })
  }

  const shop = ymShops[0]
  if (!shop.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Yandex shop has no stored API token.' }, { status: 400 })
  }
  const token = decrypt(shop.api_key_encrypted)
  const campaignId = shop.shop_id_external
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'Yandex shop is missing a campaign ID.' }, { status: 400 })
  }

  const probes: Probe[] = []

  const businessId = req.nextUrl.searchParams.get('businessId')
  const reportProbe = req.nextUrl.searchParams.get('reports') === '1'

  if (reportProbe) {
    // Probe every plausible report-generate path so we can identify
    // which URL Yandex actually accepts on THIS seller's account. All
    // are POST with the same body Yandex documents; a 200 anywhere
    // wins, everything else (404 / 400 / 405) shows up as a code.
    //
    // Resolve the businessId the boost sync actually uses: the query param
    // wins, else the shop's stored, self-healed business_id, else the
    // campaignId as a last resort. Using the REAL businessId is what makes the
    // boost-consolidated probe below return Yandex's authentic error (a
    // permission/region 403) instead of a bogus INVALID_REQUEST from a wrong id.
    const storedBid = shop.business_id
    const storedLooksValid = storedBid && /^\d+$/.test(storedBid) && storedBid !== campaignId
    const bid = businessId ?? (storedLooksValid ? storedBid : campaignId)
    const body = JSON.stringify({
      businessId: Number(bid),
      dateTimeFrom: '2026-07-01T00:00:00Z',
      dateTimeTo:   '2026-07-31T23:59:59Z',
    })
    const paths = [
      `/reports/united-netting-report/generate`,
      `/businesses/${bid}/reports/united-netting-report/generate`,
      `/reports/united-netting-report/generate?format=CSV`,
      `/reports/united-netting-report/generate?format=FILE`,
      `/reports/united-netting/generate`,
      `/reports/goods-realization/generate`,
      `/campaigns/${campaignId}/reports/united-netting-report/generate`,
      `/businesses/${bid}/reports/goods-realization/generate`,
    ]
    for (const p of paths) {
      probes.push(await postProbe(p, `${YANDEX_API_BASE}${p}`, token, body))
    }
    return NextResponse.json({
      ok: true,
      hint: 'united-netting-report: 200 = the settlements report generates on this account; a 403/404 code identifies which report path the API key accepts.',
      campaignId,
      businessId: bid,
      probes,
    }, { status: 200 })
  }

  if (orderId) {
    probes.push(await probe(
      `GET /v2/campaigns/${campaignId}/orders/${orderId}`,
      `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/orders/${orderId}`,
      token,
    ))
  } else {
    probes.push(await probe(
      `GET /v2/campaigns/${campaignId}/orders (latest)`,
      `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/orders?pageSize=10`,
      token,
    ))
  }

  return NextResponse.json({
    ok: true,
    hint: 'commissionTotal is what Yandex says the seller will be charged in commission for this order. buyerTotal − commissionTotal − deliveryTotal ≈ what the seller will actually receive.',
    campaignId,
    probes,
  }, { status: 200 })
})

// POST-flavored probe used by the ?reports=1 branch.
async function postProbe(label: string, url: string, token: string, body: string): Promise<Probe> {
  try {
    const res = await marketplaceFetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': token.trim(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      next: { revalidate: 0 },
    })
    const text = await res.text().catch(() => '')
    let parsed: unknown = null
    try { parsed = JSON.parse(text) } catch { /* ignore */ }
    return {
      label,
      url: url.replace(YANDEX_API_BASE, ''),
      ok: res.ok,
      status: res.status,
      bodySnippet: text.slice(0, 400),
      parsed,
    }
  } catch (e) {
    return {
      label,
      url: url.replace(YANDEX_API_BASE, ''),
      ok: false,
      status: 0,
      bodySnippet: e instanceof Error ? e.message : String(e),
      parsed: null,
    }
  }
}
