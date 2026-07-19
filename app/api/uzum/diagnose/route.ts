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

  // Step 2: fulfillment discovery. FBS returned 200 but 0 orders even though the
  // seller has FBS sales — so the default FBS view is filtered (likely by status:
  // it returns only orders awaiting action, not delivered/completed ones). Probe
  // a wide 365-day window across FBS (with several statuses), DBS, and unified
  // order endpoints so we can see which one actually contains the order and what
  // its status/type fields look like. Calls are spaced out to avoid 429 noise.
  const now = Date.now()
  const fromMs = now - 365 * 24 * 60 * 60 * 1000
  const orderProbes: Probe[] = []
  const gap = () => new Promise(r => setTimeout(r, 1100))
  if (uzumShopIds.length > 0) {
    const withIds = (base: Record<string, string>) => {
      const p = new URLSearchParams(base)
      for (const id of uzumShopIds) p.append('shopIds', String(id))
      return p.toString()
    }
    const dated = (extra: Record<string, string> = {}) =>
      withIds({ page: '0', size: '50', dateFrom: String(fromMs), dateTo: String(now), ...extra })

    // FBS, default view (baseline — known 200/0)
    orderProbes.push(await probe('fbs_default', `${UZUM_API_BASE}/v2/fbs/orders?${dated()}`, token)); await gap()
    // FBS with an intentionally invalid status — Uzum usually 400s with the list
    // of valid enum values in the body, which reveals the real status names.
    orderProbes.push(await probe('fbs_status_probe', `${UZUM_API_BASE}/v2/fbs/orders?${dated({ status: 'DISCOVER_VALID_STATUSES' })}`, token)); await gap()
    // FBS with common "finished" statuses so a delivered order shows up
    orderProbes.push(await probe('fbs_status_DELIVERED', `${UZUM_API_BASE}/v2/fbs/orders?${dated({ status: 'DELIVERED' })}`, token)); await gap()
    orderProbes.push(await probe('fbs_status_COMPLETED', `${UZUM_API_BASE}/v2/fbs/orders?${dated({ status: 'COMPLETED' })}`, token)); await gap()
    // DBS (delivery by seller) — not queried by the sync at all today
    orderProbes.push(await probe('dbs_default', `${UZUM_API_BASE}/v2/dbs/orders?${dated()}`, token)); await gap()
    // Unified order endpoints (some APIs expose all fulfillment types in one)
    orderProbes.push(await probe('orders_v2', `${UZUM_API_BASE}/v2/orders?${dated()}`, token)); await gap()
    orderProbes.push(await probe('orders_v1', `${UZUM_API_BASE}/v1/orders?${dated()}`, token)); await gap()
    // FBO reconfirm (expected 403 RBAC on this token)
    orderProbes.push(await probe('fbo_default', `${UZUM_API_BASE}/v2/fbo/orders?${dated()}`, token))
  }

  return NextResponse.json({
    ok: true,
    shopDbId: shop.id,
    lastSyncedAt: shop.last_synced_at,
    uzumShopIds,
    shopsProbe,
    orderProbes,
    hint: 'Find the probe with HTTP 200 and count>0 — that endpoint/status has the order; its .sample shows the real status + fulfillment fields. fbs_status_probe body often lists the valid status enum. Paste the full JSON to support.',
  })
})
