import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 120

// READ-ONLY diagnostic for FBO investigation.
// The previous investigation only grepped the OpenAPI spec for path names
// containing "fbo" and found nothing. This probe takes a broader approach:
// 1. Dumps ALL OpenAPI paths (unfiltered) so we can see the full API surface
// 2. Tries /v2/fbo/orders directly (the code already supports it!)
// 3. Tries FBO stock endpoints (/v3/fbo/sku/stocks, /v2/fbo/sku/stocks)
// 4. Dumps FULL product card fields (all types, not just numeric) to find
//    any FBO/warehouse/fulfillment metadata we're not reading
// 5. Tries warehouse-related endpoints

interface ProbeResult {
  label: string
  url: string
  status: number
  ok: boolean
  bodySnippet: string
  parsed?: unknown
}

async function tryEndpoint(label: string, url: string, token: string): Promise<ProbeResult> {
  try {
    const res = await marketplaceFetch(url, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const text = await res.text().catch(() => '')
    let parsed: unknown = null
    try { parsed = JSON.parse(text) } catch { /* non-JSON */ }
    return {
      label, url: url.replace(UZUM_API_BASE, ''), status: res.status, ok: res.ok,
      bodySnippet: text.slice(0, 800),
      parsed: res.ok ? parsed : undefined,
    }
  } catch (err) {
    return { label, url: url.replace(UZUM_API_BASE, ''), status: 0, ok: false, bodySnippet: String(err).slice(0, 300) }
  }
}

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Uzum shop/token topilmadi' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  // Resolve shop IDs
  let uzumShopIds: number[] = []
  try {
    const res = await marketplaceFetch(`${UZUM_API_BASE}/v1/shops`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const data = await res.json().catch(() => null)
    const arr = Array.isArray(data) ? data : (data?.shops ?? data?.data ?? [])
    uzumShopIds = (arr as { id: number }[]).map(s => s.id).filter(Boolean)
  } catch { /* ignore */ }

  if (uzumShopIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'No Uzum shop IDs found' })
  }

  const shopId = uzumShopIds[0]
  const gap = () => new Promise(r => setTimeout(r, 1500))

  // ── 1. ALL OpenAPI spec paths (UNFILTERED) ──────────────────────────────────
  let allPaths: string[] = []
  let fboRelatedPaths: { path: string; methods: string[] }[] = []
  try {
    const res = await marketplaceFetch(`${UZUM_API_BASE}/swagger/api-docs`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const spec = await res.json().catch(() => null)
    if (spec?.paths) {
      allPaths = Object.keys(spec.paths).sort()
      // Broader keyword search than before
      const keywords = /fbo|fbs|dbs|warehouse|fulfil|stock|inventory|pool|delivery|shipment|supply|receive|return|logistic/i
      for (const [path, ops] of Object.entries(spec.paths)) {
        if (keywords.test(path)) {
          const methods = Object.keys(ops as object).filter(m => ['get', 'post', 'put', 'patch'].includes(m))
          fboRelatedPaths.push({ path, methods })
        }
      }
    }
  } catch { /* ignore */ }
  await gap()

  // ── 2. Try FBO order endpoints ──────────────────────────────────────────────
  const params = `page=0&size=10&shopIds=${shopId}`
  const fboOrderProbes: ProbeResult[] = []
  fboOrderProbes.push(await tryEndpoint('fbo_orders_v2', `${UZUM_API_BASE}/v2/fbo/orders?${params}`, token)); await gap()
  fboOrderProbes.push(await tryEndpoint('fbo_orders_v1', `${UZUM_API_BASE}/v1/fbo/orders?${params}`, token)); await gap()
  fboOrderProbes.push(await tryEndpoint('dbs_orders_v2', `${UZUM_API_BASE}/v2/dbs/orders?${params}`, token)); await gap()

  // ── 3. Try FBO stock endpoints ──────────────────────────────────────────────
  const fboStockProbes: ProbeResult[] = []
  fboStockProbes.push(await tryEndpoint('fbo_stocks_v3', `${UZUM_API_BASE}/v3/fbo/sku/stocks?page=0&size=10`, token)); await gap()
  fboStockProbes.push(await tryEndpoint('fbo_stocks_v2', `${UZUM_API_BASE}/v2/fbo/sku/stocks?page=0&size=10`, token)); await gap()
  fboStockProbes.push(await tryEndpoint('dbs_stocks_v3', `${UZUM_API_BASE}/v3/dbs/sku/stocks?page=0&size=10`, token)); await gap()
  fboStockProbes.push(await tryEndpoint('dbs_stocks_v2', `${UZUM_API_BASE}/v2/dbs/sku/stocks?page=0&size=10`, token)); await gap()

  // ── 4. Try warehouse/inventory endpoints ────────────────────────────────────
  const warehouseProbes: ProbeResult[] = []
  warehouseProbes.push(await tryEndpoint('warehouses_v1', `${UZUM_API_BASE}/v1/warehouses?shopIds=${shopId}`, token)); await gap()
  warehouseProbes.push(await tryEndpoint('warehouses_v2', `${UZUM_API_BASE}/v2/warehouses?shopIds=${shopId}`, token)); await gap()
  warehouseProbes.push(await tryEndpoint('warehouse_stocks', `${UZUM_API_BASE}/v1/warehouse/stocks?shopIds=${shopId}`, token)); await gap()
  warehouseProbes.push(await tryEndpoint('supply_v1', `${UZUM_API_BASE}/v1/supply?shopIds=${shopId}&page=0&size=10`, token)); await gap()
  warehouseProbes.push(await tryEndpoint('supply_v2', `${UZUM_API_BASE}/v2/supply?shopIds=${shopId}&page=0&size=10`, token)); await gap()
  warehouseProbes.push(await tryEndpoint('returns_v1', `${UZUM_API_BASE}/v1/returns?shopIds=${shopId}&page=0&size=10`, token)); await gap()

  // ── 5. Full product card dump (ALL fields, all types) ───────────────────────
  // Previous investigation only captured numeric fields. FBO metadata could be
  // in string fields (fulfillmentType, warehouseId, poolType, etc.)
  let fullProductDump: unknown = null
  try {
    const res = await marketplaceFetch(
      `${UZUM_API_BASE}/v1/product/shop/${shopId}?page=0&size=3&filter=ALL`,
      { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
    )
    const data = await res.json().catch(() => null) as { productList?: unknown[] } | null
    const list = data?.productList ?? []
    fullProductDump = list.map((card: unknown) => {
      const c = card as Record<string, unknown>
      // Dump ALL card-level fields
      const cardFields: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(c)) {
        if (k === 'skuList') continue // handled separately
        cardFields[k] = v
      }
      // Dump ALL fields on each SKU (not just numeric)
      const skus = ((c.skuList ?? []) as Record<string, unknown>[]).map(sku => {
        const allFields: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(sku)) {
          allFields[k] = v
        }
        return allFields
      })
      return { cardFields, skus }
    })
  } catch (err) {
    fullProductDump = { error: String(err).slice(0, 300) }
  }
  await gap()

  // ── 6. FBS stocks with full field dump (check for dbsLinked and other flags) ─
  let fbsStocksDump: unknown = null
  try {
    const res = await marketplaceFetch(
      `${UZUM_API_BASE}/v3/fbs/sku/stocks?page=0&size=10`,
      { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
    )
    const raw = await res.json().catch(() => null)
    // Dump raw response structure so we can see ALL fields
    fbsStocksDump = {
      topLevelKeys: raw ? Object.keys(raw) : [],
      payloadKeys: raw?.payload ? Object.keys(raw.payload) : [],
      raw: JSON.parse(JSON.stringify(raw)).toString !== undefined ? raw : JSON.stringify(raw).slice(0, 2000),
    }
  } catch (err) {
    fbsStocksDump = { error: String(err).slice(0, 300) }
  }

  return NextResponse.json({
    ok: true,
    shopId,
    uzumShopIds,
    // Full API surface — every path in the OpenAPI spec
    allSpecPaths: allPaths,
    totalPaths: allPaths.length,
    // Paths matching FBO/stock/warehouse/fulfillment/delivery keywords
    fboRelatedPaths,
    // FBO order endpoint probes
    fboOrderProbes: fboOrderProbes.map(p => ({ label: p.label, status: p.status, ok: p.ok, body: p.bodySnippet })),
    // FBO stock endpoint probes
    fboStockProbes: fboStockProbes.map(p => ({ label: p.label, status: p.status, ok: p.ok, body: p.bodySnippet })),
    // Warehouse/supply/returns endpoint probes
    warehouseProbes: warehouseProbes.map(p => ({ label: p.label, status: p.status, ok: p.ok, body: p.bodySnippet })),
    // Full product card with ALL fields (not just numeric)
    fullProductDump,
    // FBS stocks raw dump (check for dbsLinked, fulfillment flags)
    fbsStocksDump,
    hint: 'Look for: (1) any 200-status FBO/DBS endpoint, (2) fields like fulfillmentType/warehouseId/poolType/dbsLinked on product cards, (3) any spec path we missed. The product card dump shows ALL fields including strings — FBO metadata might be there.',
  })
})
