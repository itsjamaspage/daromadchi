import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

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
    const res = await marketplaceFetch(url, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
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

  // Step 2: orders. Several variants to pin down the 400/403 cause. Calls are
  // spaced out so Uzum's rate limiter doesn't turn real errors into 429 noise.
  const now = Date.now()
  const fromMs = now - 90 * 24 * 60 * 60 * 1000
  const orderProbes: Probe[] = []
  const gap = () => new Promise(r => setTimeout(r, 1200))
  if (uzumShopIds.length > 0) {
    const withIds = (base: Record<string, string>) => {
      const p = new URLSearchParams(base)
      for (const id of uzumShopIds) p.append('shopIds', String(id))
      return p.toString()
    }

    // A) date range as epoch ms (what the sync currently sends)
    orderProbes.push(await probe('fbs_dateFrom_ms', `${UZUM_API_BASE}/v2/fbs/orders?${withIds({ page: '0', size: '50', dateFrom: String(fromMs) })}`, token)); await gap()
    // B) date range with BOTH dateFrom and dateTo (common 400 cause: dateTo required)
    orderProbes.push(await probe('fbs_dateFrom_dateTo', `${UZUM_API_BASE}/v2/fbs/orders?${withIds({ page: '0', size: '50', dateFrom: String(fromMs), dateTo: String(now) })}`, token)); await gap()
    // C) no date filter at all
    orderProbes.push(await probe('fbs_no_date', `${UZUM_API_BASE}/v2/fbs/orders?${withIds({ page: '0', size: '50' })}`, token)); await gap()
    // D) FBO with both dates
    orderProbes.push(await probe('fbo_dateFrom_dateTo', `${UZUM_API_BASE}/v2/fbo/orders?${withIds({ page: '0', size: '50', dateFrom: String(fromMs), dateTo: String(now) })}`, token)); await gap()
    // E) single shopId param name variant (some endpoints want `shopId`, not `shopIds`)
    const single = new URLSearchParams({ page: '0', size: '50', shopId: String(uzumShopIds[0]) })
    orderProbes.push(await probe('fbs_shopId_singular', `${UZUM_API_BASE}/v2/fbs/orders?${single}`, token))
  }

  return NextResponse.json({
    ok: true,
    shopDbId: shop.id,
    lastSyncedAt: shop.last_synced_at,
    uzumShopIds,
    shopsProbe,
    orderProbes,
    hint: 'Look at orderProbes[].status and .count. 200 with count>0 means the API returns orders (sync should store them). 4xx/0 means the token or endpoint is the problem — paste bodySnippet to support.',
  })
})
