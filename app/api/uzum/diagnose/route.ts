import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  // Step 2: discover the REAL FBS status enum from Uzum's OpenAPI spec, then
  // sweep those exact values (guessing names just yields "Bad request"). Only
  // CREATED / DELIVERED / COMPLETED were valid so far, and the in-transit order
  // is in none of them — so we need the authoritative list.
  const now = Date.now()
  const fromMs = now - 365 * 24 * 60 * 60 * 1000
  const orderProbes: Probe[] = []
  const gap = () => new Promise(r => setTimeout(r, 1100))

  const { specPath, discoveredStatuses } = await discoverStatuses(token)

  // Statuses to sweep: whatever the spec revealed, else a broad fallback list.
  // Always include the three we know are valid so counts are comparable.
  const known = ['CREATED', 'DELIVERED', 'COMPLETED']
  const fallback = [
    'CONFIRMED', 'AGREED', 'ACCEPTED', 'PACKED', 'PACKAGED', 'ASSEMBLED',
    'READY', 'SENT', 'HANDED_OVER', 'TRANSFERRED', 'ON_DELIVERY', 'DELIVERING',
    'CANCELED', 'RETURNED', 'EXPIRED', 'PENDING', 'ACTIVE',
  ]
  const sweep = [...new Set([...known, ...discoveredStatuses, ...fallback])].slice(0, 24)

  if (uzumShopIds.length > 0) {
    const withIds = (base: Record<string, string>) => {
      const p = new URLSearchParams(base)
      for (const id of uzumShopIds) p.append('shopIds', String(id))
      return p.toString()
    }
    const dated = (extra: Record<string, string> = {}) =>
      withIds({ page: '0', size: '50', dateFrom: String(fromMs), dateTo: String(now), ...extra })

    for (const st of sweep) {
      orderProbes.push(await probe(`fbs_${st}`, `${UZUM_API_BASE}/v2/fbs/orders?${dated({ status: st })}`, token))
      await gap()
    }
  }

  // Which statuses are actually valid (200) vs rejected (400), and which hold data.
  const validStatuses = orderProbes.filter(p => p.status === 200).map(p => `${p.label.replace('fbs_', '')}${p.count ? `(${p.count})` : ''}`)

  return NextResponse.json({
    ok: true,
    shopDbId: shop.id,
    lastSyncedAt: shop.last_synced_at,
    uzumShopIds,
    specPath,
    discoveredStatuses,
    validStatuses,
    shopsProbe,
    orderProbes,
    hint: 'validStatuses lists the FBS statuses that returned 200; the one with (n>0) holds the order. discoveredStatuses is what Uzum\'s OpenAPI spec exposed. Paste the full JSON to support.',
  })
})
