import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, orders } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE, fetchAllUzumSkuStocks } from '@/lib/uzum/client'
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
      // Non-list 200s (order detail, counts) matter too — show the raw body so
      // a working by-id endpoint is recognizable at a glance.
      sample: list && list.length > 0 ? list[0] : (res.ok && json != null && !list ? text.slice(0, 400) : null),
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

// Fetch Uzum's OpenAPI spec JSON (tries the common paths). Read-only — a plain
// GET the readonly guard always allows. Returns the parsed spec + the path it
// came from, or null when none of the candidates serve a usable spec.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchUzumOpenApiSpec(token: string): Promise<{ specPath: string; spec: any } | null> {
  // The swagger UI is served under /swagger/… (see lib/uzum/client.ts), so the
  // spec most likely lives there too — try those first.
  const paths = [
    '/swagger/v3/api-docs', '/swagger/api-docs', '/swagger/v2/api-docs',
    '/v3/api-docs', '/api-docs', '/swagger/v1/api-docs', '/v3/api-docs/swagger-config',
  ]
  for (const p of paths) {
    try {
      const res = await marketplaceFetch(`${UZUM_API_BASE}${p}`, {
        headers: { Authorization: token.trim(), Accept: 'application/json' },
        next: { revalidate: 0 },
      })
      if (!res.ok) continue
      const json = await res.json().catch(() => null)
      if (!json || (typeof json === 'object' && !('openapi' in json) && !('swagger' in json) && !('components' in json) && !('paths' in json))) continue
      return { specPath: p, spec: json }
    } catch { /* try next path */ }
  }
  return null
}

// Resolve a possibly-$ref schema node against the spec root ($ref chains only).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveRef(spec: any, node: any, depth = 0): any {
  if (depth > 8 || node == null || typeof node !== 'object') return node
  if (typeof node.$ref === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = spec
    for (const part of node.$ref.replace(/^#\//, '').split('/')) cur = cur?.[part]
    return resolveRef(spec, cur, depth + 1)
  }
  return node
}

// Compact, up-to-two-level description of a request schema: the field names,
// their types/enums, and which are REQUIRED. This is what disambiguates the
// stock-write DTO (right field names? is fbsLinked here and required?).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeSchema(spec: any, schema: any, depth = 0): unknown {
  schema = resolveRef(spec, schema)
  if (!schema || typeof schema !== 'object') return null
  if (schema.type === 'array' || schema.items) {
    return { type: 'array', items: depth < 3 ? describeSchema(spec, schema.items, depth + 1) : '…' }
  }
  const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : null
  if (!props) return { type: schema.type ?? 'unknown', ...(schema.enum ? { enum: schema.enum } : {}) }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    const rv = resolveRef(spec, v)
    if (depth < 2 && rv && (rv.type === 'array' || rv.properties)) {
      out[k] = describeSchema(spec, rv, depth + 1)
    } else {
      out[k] = {
        type: rv?.type ?? 'unknown',
        ...(rv?.format ? { format: rv.format } : {}),
        ...(rv?.enum ? { enum: rv.enum } : {}),
      }
    }
  }
  return { type: 'object', required: schema.required ?? [], properties: out }
}

// Extract the AUTHORITATIVE request DTO for the Uzum stock-WRITE endpoint(s)
// straight from Uzum's OpenAPI spec — every /fbs/sku/stocks path with a POST or
// PUT, resolved to concrete field names/required flags. This is the ground truth
// for fixing validation-failed-001 without guessing the shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function discoverStockWriteDto(spec: any): unknown[] {
  const results: unknown[] = []
  const paths = spec?.paths
  if (!paths || typeof paths !== 'object') return results
  for (const [path, ops] of Object.entries(paths)) {
    if (!/\/fbs\/sku\/stocks\/?$/.test(path)) continue
    for (const method of ['post', 'put', 'patch']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const op = (ops as any)?.[method]
      if (!op) continue
      const schema = op.requestBody?.content?.['application/json']?.schema
      results.push({
        path,
        method: method.toUpperCase(),
        summary: op.summary ?? op.operationId ?? null,
        requestBody: schema ? describeSchema(spec, schema) : null,
      })
    }
  }
  return results
}

export const GET = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Optional: probe a SPECIFIC order number (e.g. the invisible active order,
  // whose number is visible in the seller cabinet): /api/uzum/diagnose?orderId=123
  const askedId = new URL(req.url).searchParams.get('orderId')?.trim() || null

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

  // Step 2: hunt for the ACTIVE order through OTHER DOORS. The status sweep is
  // exhausted (all 6 valid statuses return 0 while the order exists in the
  // cabinet), so probe: (a) an order-detail endpoint by a KNOWN id — if that
  // works, any order number visible in the cabinet can be fetched directly;
  // (b) alternate list-query shapes (statuses= plural, repeated status=, no
  // pagination params); (c) the FBS invoice/supply resources where a
  // not-yet-shipped order may live. All read-only GETs, 2s apart.
  const orderProbes: Probe[] = []
  const gap = () => new Promise(r => setTimeout(r, 2000))

  // Fetch Uzum's OpenAPI spec ONCE and mine it for both the FBS order-status
  // enum AND the authoritative stock-WRITE request DTO (the ground truth for the
  // validation-failed-001 the live stock write returns).
  const specResult = await fetchUzumOpenApiSpec(token)
  const specPath = specResult?.specPath ?? null
  const discoveredStatuses: string[] = (() => {
    if (!specResult) return []
    const out = new Set<string>()
    collectStatusEnums(specResult.spec, out)
    return [...out]
  })()
  const stockWriteDto = specResult ? discoverStockWriteDto(specResult.spec) : []

  // A known-real external order id from our DB (the cancelled order) — used to
  // discover whether a by-id detail endpoint exists at all.
  const [knownOrder] = await db.select({ ext: orders.order_id_external })
    .from(orders).where(and(eq(orders.shop_id, shop.id), eq(orders.marketplace, 'uzum')))
    .limit(1)
  const knownId = knownOrder?.ext ?? null

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

    // (a) Detail-by-id: works with the known id → the cabinet's order number
    // for the invisible order can be fetched the same way.
    if (knownId) {
      orderProbes.push(await probe('detail /v2/fbs/orders/{id}', `${UZUM_API_BASE}/v2/fbs/orders/${knownId}`, token)); await gap()
      orderProbes.push(await probe('detail /v2/fbs/order/{id}', `${UZUM_API_BASE}/v2/fbs/order/${knownId}`, token)); await gap()
    }
    // A user-supplied order number (?orderId=…) — the direct test for the
    // invisible order once its number is read off the seller cabinet.
    if (askedId && /^\d+$/.test(askedId)) {
      orderProbes.push(await probe(`asked /v2/fbs/orders/${askedId}`, `${UZUM_API_BASE}/v2/fbs/orders/${askedId}`, token)); await gap()
      orderProbes.push(await probe(`asked /v2/fbs/order/${askedId}`, `${UZUM_API_BASE}/v2/fbs/order/${askedId}`, token)); await gap()
    }

    // (b) Alternate list shapes.
    orderProbes.push(await probe('fbs_CREATED_noPaging', `${UZUM_API_BASE}/v2/fbs/orders?${withIds({ status: 'CREATED' })}`, token)); await gap()
    orderProbes.push(await probe('fbs_statuses_plural', `${UZUM_API_BASE}/v2/fbs/orders?${q({ statuses: 'CREATED' })}`, token)); await gap()
    {
      const multi = new URLSearchParams({ page: '0', size: '50' })
      for (const id of uzumShopIds) multi.append('shopIds', String(id))
      multi.append('status', 'CREATED'); multi.append('status', 'DELIVERING')
      orderProbes.push(await probe('fbs_multiStatus', `${UZUM_API_BASE}/v2/fbs/orders?${multi}`, token)); await gap()
    }

    // (c) Invoice/supply resources + alternate endpoints.
    orderProbes.push(await probe('fbs_invoice_v2', `${UZUM_API_BASE}/v2/fbs/invoice?${q({})}`, token)); await gap()
    orderProbes.push(await probe('invoice_v1', `${UZUM_API_BASE}/v1/invoice?${q({})}`, token)); await gap()
    orderProbes.push(await probe('fbs_v1', `${UZUM_API_BASE}/v1/fbs/orders?${q({})}`, token)); await gap()
    orderProbes.push(await probe('dbs_CREATED', `${UZUM_API_BASE}/v2/dbs/orders?${q({ status: 'CREATED' })}`, token))
  }

  // Product sample — confirms SKU.quantitySold (our FBO "sold" workaround) is
  // present and populated for this seller.
  let productSample: unknown = null
  // Raw stock-field breakdown per SKU so we can see WHICH Uzum field is
  // contributing to a mismatch between daromadchi and the seller cabinet
  // ("Закончился" in cabinet vs stock=N in daromadchi). Dumps every numeric
  // field on each sku (not just the ones we type) so unknown-to-us buckets
  // like quantityReserved / quantityReturning / quantityWaitingReceipt show up.
  let productStocks: unknown = null
  if (uzumShopIds[0]) {
    const pp = await probe('product_sample', `${UZUM_API_BASE}/v1/product/shop/${uzumShopIds[0]}?page=0&size=5&filter=ALL`, token)
    productSample = pp.sample ?? pp.bodySnippet
    try {
      const res = await marketplaceFetch(
        `${UZUM_API_BASE}/v1/product/shop/${uzumShopIds[0]}?page=0&size=50&filter=ALL`,
        { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
      )
      const data = await res.json().catch(() => null) as { productList?: unknown[] } | null
      const list = data?.productList ?? []
      productStocks = list.flatMap((card: unknown) => {
        const c = card as { productId?: number; title?: string; skuList?: unknown[] }
        return (c.skuList ?? []).map((sku: unknown) => {
          const s = sku as Record<string, unknown>
          const numeric: Record<string, number> = {}
          for (const [k, v] of Object.entries(s)) {
            if (typeof v === 'number') numeric[k] = v
          }
          return {
            productId: c.productId,
            title: c.title,
            skuId: s.skuId,
            sellerItemCode: s.sellerItemCode ?? s.article,
            numericFields: numeric,
          }
        })
      })
    } catch { /* best-effort */ }
  }

  // Raw sample of the v3 /fbs/sku/stocks records — the EXACT source the barcode
  // backfill matches against. Dumps every key each record carries (not just the
  // ones we type) so the field that holds the seller article (sellerItemCode /
  // skuTitle / …) and the per-variant barcode is visible, and any cross-wired
  // barcode↔SKU mapping can be pinned without guessing.
  let skuStocksSample: unknown = null
  try {
    const stocks = await fetchAllUzumSkuStocks(token)
    skuStocksSample = {
      count: stocks.length,
      records: stocks.slice(0, 12).map((s) => {
        const r = s as Record<string, unknown>
        return { allKeys: Object.keys(r), ...r }
      }),
    }
  } catch (err) {
    skuStocksSample = { error: String(err).slice(0, 300) }
  }

  const validStatuses = orderProbes.filter(p => p.status === 200).map(p => `${p.label}${p.count ? `(${p.count})` : '(0)'}`)

  return NextResponse.json({
    ok: true,
    shopDbId: shop.id,
    lastSyncedAt: shop.last_synced_at,
    uzumShopIds,
    specPath,
    discoveredStatuses,
    // Authoritative stock-WRITE request DTO(s) mined from Uzum's OpenAPI spec —
    // the exact field names / required flags the write must match to stop
    // returning validation-failed-001. Empty [] means the spec wasn't reachable.
    stockWriteDto,
    // Raw v3 /fbs/sku/stocks records the barcode backfill matches on — compare
    // each record's seller-article field + barcode against products.sku to see
    // which SKUs were cross-wired to the wrong barcode.
    skuStocksSample,
    validStatuses,
    productSample,
    productStocks,
    shopsProbe,
    orderProbes,
    hint: 'stockWriteDto = the authoritative Uzum stock-write request DTO from their OpenAPI spec — compare its field names/required flags against what we send ({skuAmountList:[{barcode,amount,fbsLinked}]}) to fix validation-failed-001. validStatuses = FBS statuses that returned 200. productSample shows whether SKU.quantitySold is populated. Paste the full JSON to support.',
  })
})
