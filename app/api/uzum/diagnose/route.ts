import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 120 // the status-hunt probe set + 429 retries can exceed 60s

// READ-ONLY diagnostic. Calls the Uzum seller API exactly the way the sync does
// (GET /v1/shops, GET /v2/fbs|fbo/orders) and reports raw HTTP status, counts,
// and error bodies WITHOUT writing anything to the DB or the marketplace. Lets
// the seller (and support) see why orders aren't landing without guessing.

interface Probe {
  label: string
  url: string
  ok: boolean
  status: number
  count: number | null
  sample: unknown
  bodySnippet: string
}

async function probe(label: string, url: string, token: string): Promise<Probe> {
  try {
    // Retry on 429 so Uzum's rate limiter doesn't mask the real result.
    let res = await marketplaceFetch(url, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    for (let attempt = 0; attempt < 3 && res.status === 429; attempt++) {
      await new Promise(r => setTimeout(r, 2500))
      res = await marketplaceFetch(url, {
        headers: { Authorization: token.trim(), Accept: 'application/json' },
        next: { revalidate: 0 },
      })
    }
    const text = await res.text().catch(() => '')
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* non-JSON body */ }

    // Order responses nest under payload.orders; shops are a bare array.
    const j = json as
      | { payload?: { orders?: unknown[]; totalCount?: number }; data?: unknown[]; orders?: unknown[] }
      | unknown[]
      | null
    let list: unknown[] | null = null
    if (Array.isArray(j)) list = j
    else if (j && typeof j === 'object') {
      const o = j as { payload?: { orders?: unknown[] }; data?: unknown[]; orders?: unknown[] }
      list = o.payload?.orders ?? o.data ?? o.orders ?? null
    }

    return {
      label,
      url: url.replace(UZUM_API_BASE, ''),
      ok: res.ok,
      status: res.status,
      count: list ? list.length : null,
      sample: list && list.length > 0 ? list[0] : null,
      bodySnippet: res.ok ? '' : text.slice(0, 300),
    }
  } catch (err) {
    return {
      label,
      url: url.replace(UZUM_API_BASE, ''),
      ok: false,
      status: 0,
      count: null,
      sample: null,
      bodySnippet: String(err).slice(0, 300),
    }
  }
}

// Walk a parsed JSON object and collect every string[] enum that looks like an
// order-status list (contains a known status token). Uzum's OpenAPI spec puts
// the real status values in components.schemas.*.enum.
function collectStatusEnums(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 12 || node == null) return
  if (Array.isArray(node)) {
    const allStrings = node.every(v => typeof v === 'string')
    if (allStrings && node.length > 0) {
      const upper = node as string[]
      const looksLikeStatus = upper.some(v => /^(CREATED|DELIVERED|COMPLETED|CANCELED|CANCELLED|CONFIRMED|SHIPPED|RETURNED)$/.test(v))
      if (looksLikeStatus) for (const v of upper) if (/^[A-Z][A-Z0-9_]{2,}$/.test(v)) out.add(v)
    } else {
      for (const v of node) collectStatusEnums(v, out, depth + 1)
    }
    return
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) collectStatusEnums(v, out, depth + 1)
  }
}

// Fetch Uzum's OpenAPI spec (tries the common paths) and extract the FBS order
// status enum, so we sweep real values instead of guessing.
async function discoverStatuses(token: string): Promise<{ specPath: string | null; discoveredStatuses: string[] }> {
  const paths = ['/v3/api-docs', '/api-docs', '/swagger/v1/api-docs', '/v3/api-docs/swagger-config']
  for (const p of paths) {
    try {
      const res = await marketplaceFetch(`${UZUM_API_BASE}${p}`, {
        headers: { Authorization: token.trim(), Accept: 'application/json' },
        next: { revalidate: 0 },
      })
      if (!res.ok) continue
      const json = await res.json().catch(() => null)
      if (!json || (typeof json === 'object' && !('openapi' in json) && !('swagger' in json) && !('components' in json) && !('paths' in json))) continue
      const out = new Set<string>()
      collectStatusEnums(json, out)
      if (out.size > 0) return { specPath: p, discoveredStatuses: [...out] }
      return { specPath: p, discoveredStatuses: [] }
    } catch { /* try next path */ }
  }
  return { specPath: null, discoveredStatuses: [] }
}

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    id: shops.id,
    last_synced_at: shops.last_synced_at,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Uzum shop/token topilmadi' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  // Step 1: shops — probe for status, and extract the shop ids for order calls.
  const shopsProbe = await probe('shops', `${UZUM_API_BASE}/v1/shops`, token)
  let uzumShopIds: number[] = []
  try {
    const res = await marketplaceFetch(`${UZUM_API_BASE}/v1/shops`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const data = await res.json().catch(() => null)
    const arr = Array.isArray(data) ? data : (data?.shops ?? data?.data ?? [])
    uzumShopIds = (arr as { id: number }[]).map(s => s.id).filter(Boolean)
  } catch { /* status already captured by shopsProbe */ }

  // Step 2: hunt for the ACTIVE order the API isn't showing. A real
  // not-yet-shipped order exists in the seller cabinet, yet every one of our 6
  // known statuses returns 0 (only the CANCELED one shows its order). So the
  // active order must be behind (a) a status name we haven't discovered, or
  // (b) the date-filter variant in epoch SECONDS (ms was proven broken), or
  // (c) a different endpoint. All read-only GETs, 2s apart for the rate limit.
  const orderProbes: Probe[] = []
  const gap = () => new Promise(r => setTimeout(r, 2000))

  const { specPath, discoveredStatuses } = await discoverStatuses(token)

  if (uzumShopIds.length > 0) {
    const withIds = (base: Record<string, string>) => {
      const p = new URLSearchParams(base)
      for (const id of uzumShopIds) p.append('shopIds', String(id))
      return p.toString()
    }
    const q = (extra: Record<string, string>) => withIds({ page: '0', size: '50', ...extra })

    // Controls: CANCELED must return 1; CREATED currently returns 0.
    orderProbes.push(await probe('fbs_CANCELED', `${UZUM_API_BASE}/v2/fbs/orders?${q({ status: 'CANCELED' })}`, token)); await gap()
    orderProbes.push(await probe('fbs_CREATED', `${UZUM_API_BASE}/v2/fbs/orders?${q({ status: 'CREATED' })}`, token)); await gap()

    // (b) Status-less with dates in epoch SECONDS (never tried — ms was the
    // broken variant). If this returns orders, the sync can drop statuses.
    const nowSec = Math.floor(Date.now() / 1000)
    const fromSec = nowSec - 90 * 24 * 3600
    orderProbes.push(await probe('fbs_noStatus_dateSeconds',
      `${UZUM_API_BASE}/v2/fbs/orders?${q({ dateFrom: String(fromSec), dateTo: String(nowSec) })}`, token)); await gap()

    // (a) Candidate status names for "new/processing" orders. Invalid names
    // cost one cheap 400 each; a 200 with count>0 is the jackpot.
    for (const st of ['PACKING', 'PACKED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_SHIPMENT', 'IN_TRANSIT']) {
      orderProbes.push(await probe(`fbs_${st}`, `${UZUM_API_BASE}/v2/fbs/orders?${q({ status: st })}`, token)); await gap()
    }

    // (c) Alternate endpoints a "new" order might live behind.
    orderProbes.push(await probe('fbs_v1', `${UZUM_API_BASE}/v1/fbs/orders?${q({})}`, token)); await gap()
    orderProbes.push(await probe('dbs_CREATED', `${UZUM_API_BASE}/v2/dbs/orders?${q({ status: 'CREATED' })}`, token))
  }

  // Product sample — confirms SKU.quantitySold (our FBO "sold" workaround) is
  // present and populated for this seller.
  let productSample: unknown = null
  if (uzumShopIds[0]) {
    const pp = await probe('product_sample', `${UZUM_API_BASE}/v1/product/shop/${uzumShopIds[0]}?page=0&size=5&filter=ALL`, token)
    productSample = pp.sample ?? pp.bodySnippet
  }

  const validStatuses = orderProbes.filter(p => p.status === 200).map(p => `${p.label}${p.count ? `(${p.count})` : '(0)'}`)

  return NextResponse.json({
    ok: true,
    shopDbId: shop.id,
    lastSyncedAt: shop.last_synced_at,
    uzumShopIds,
    specPath,
    discoveredStatuses,
    validStatuses,
    productSample,
    shopsProbe,
    orderProbes,
    hint: 'validStatuses = FBS statuses that returned 200. productSample shows whether SKU.quantitySold is populated (our FBO sold workaround). analytics_* probes hunt for an FBO revenue source a read-only key can reach. Paste the full JSON to support.',
  })
})
