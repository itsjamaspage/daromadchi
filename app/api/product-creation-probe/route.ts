import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { YANDEX_API_BASE } from '@/lib/yandex/client'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 120

// READ-ONLY investigation for Task 15 (product creation) and Task 16 (returns).
// Mines the Uzum OpenAPI spec for product-creation and returns endpoints,
// and probes Yandex for product-creation API surface.
// NO WRITES — only GET requests and spec reading.

const gap = () => new Promise(r => setTimeout(r, 1500))

interface ProbeResult {
  label: string
  url: string
  status: number
  ok: boolean
  bodySnippet: string
}

async function tryGet(label: string, url: string, headers: Record<string, string>): Promise<ProbeResult> {
  try {
    const res = await marketplaceFetch(url, {
      headers: { ...headers, Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const text = await res.text().catch(() => '')
    return {
      label,
      url: url.replace(UZUM_API_BASE, '[uzum]').replace(YANDEX_API_BASE, '[yandex]'),
      status: res.status,
      ok: res.ok,
      bodySnippet: text.slice(0, 1200),
    }
  } catch (err) {
    return { label, url, status: 0, ok: false, bodySnippet: String(err).slice(0, 300) }
  }
}

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Get both Uzum and Yandex shops
  const allShops = await db.select({
    id: shops.id,
    marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
    business_id: shops.business_id,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.is_active, true)))

  const uzumShop = allShops.find(s => s.marketplace === 'uzum')
  const yandexShop = allShops.find(s => s.marketplace === 'yandex_market')

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1: UZUM — Mine OpenAPI spec for product creation + returns endpoints
  // ══════════════════════════════════════════════════════════════════════════

  const uzumProductPaths: { path: string; methods: string[]; summary?: string }[] = []
  const uzumReturnPaths: { path: string; methods: string[]; summary?: string }[] = []
  const uzumAllPaths: { path: string; methods: string[]; tag?: string; summary?: string }[] = []

  if (uzumShop?.api_key_encrypted) {
    const uzumToken = decrypt(uzumShop.api_key_encrypted)

    try {
      const res = await marketplaceFetch(`${UZUM_API_BASE}/swagger/api-docs`, {
        headers: { Authorization: uzumToken.trim(), Accept: 'application/json' },
        next: { revalidate: 0 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spec = await res.json().catch(() => null) as any
      if (spec?.paths) {
        for (const [path, ops] of Object.entries(spec.paths)) {
          const opObj = ops as Record<string, { tags?: string[]; summary?: string; description?: string }>
          const methods = Object.keys(opObj).filter(m => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
          const firstOp = opObj[methods[0] ?? 'get']
          const tag = firstOp?.tags?.[0]
          const summary = firstOp?.summary ?? firstOp?.description

          uzumAllPaths.push({ path, methods, tag, summary })

          // Product creation: look for POST/PUT on product paths
          const isProductPath = /product|item|offer|listing|catalog|goods|sku|tovar/i.test(path)
          const hasWriteMethod = methods.some(m => ['post', 'put', 'patch'].includes(m))
          if (isProductPath && hasWriteMethod) {
            uzumProductPaths.push({ path, methods, summary })
          }

          // Returns/warehouse: broader search
          const isReturnPath = /return|vozvrat|warehouse|sergeli|refund|claim|invoice/i.test(path)
          if (isReturnPath) {
            uzumReturnPaths.push({ path, methods, summary })
          }
        }
      }
    } catch { /* ignore */ }
    await gap()

    // Also dump the full schemas for Product-tagged operations
    // to understand what fields product creation needs
    try {
      const res = await marketplaceFetch(`${UZUM_API_BASE}/swagger/api-docs`, {
        headers: { Authorization: uzumToken.trim(), Accept: 'application/json' },
        next: { revalidate: 0 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spec = await res.json().catch(() => null) as any
      if (spec?.paths) {
        for (const writePath of uzumProductPaths) {
          const pathOps = spec.paths[writePath.path]
          for (const method of writePath.methods) {
            if (['post', 'put', 'patch'].includes(method) && pathOps?.[method]) {
              const op = pathOps[method]
              // Extract request body schema reference
              const bodyRef = op.requestBody?.content?.['application/json']?.schema?.$ref
              const bodySchema = op.requestBody?.content?.['application/json']?.schema
              writePath.summary = JSON.stringify({
                summary: op.summary,
                description: op.description,
                bodyRef,
                bodySchemaKeys: bodySchema ? Object.keys(bodySchema) : [],
                parameters: op.parameters?.map((p: { name: string; in: string; required?: boolean }) =>
                  ({ name: p.name, in: p.in, required: p.required })),
              }).slice(0, 800)
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2: YANDEX — Probe product creation endpoints
  // ══════════════════════════════════════════════════════════════════════════

  const yandexProbes: ProbeResult[] = []
  let yandexBusinessId: number | null = null
  let yandexCampaignId: string | null = null

  if (yandexShop?.api_key_encrypted) {
    const yandexToken = decrypt(yandexShop.api_key_encrypted)
    yandexBusinessId = yandexShop.business_id ? Number(yandexShop.business_id) : null
    yandexCampaignId = yandexShop.shop_id_external ?? null
    const headers = { 'Api-Key': yandexToken, 'Content-Type': 'application/json' }

    // Yandex product creation docs say:
    // POST /v2/businesses/{businessId}/offer-mappings/update — create/update offers
    // POST /v2/businesses/{businessId}/offer-cards/update — update offer cards
    // POST /v2/businesses/{businessId}/offer-mappings/archive — archive offers
    // POST /v2/businesses/{businessId}/offer-mappings/unarchive — unarchive

    if (yandexBusinessId) {
      // Probe: check if update endpoint exists (OPTIONS/GET to see if it responds)
      yandexProbes.push(await tryGet(
        'offer-mappings-update',
        `${YANDEX_API_BASE}/v2/businesses/${yandexBusinessId}/offer-mappings/update`,
        headers,
      ))
      await gap()

      yandexProbes.push(await tryGet(
        'offer-cards-update',
        `${YANDEX_API_BASE}/v2/businesses/${yandexBusinessId}/offer-cards/update`,
        headers,
      ))
      await gap()

      // Category tree (needed for product creation)
      yandexProbes.push(await tryGet(
        'categories-tree',
        `${YANDEX_API_BASE}/v2/categories/tree`,
        headers,
      ))
      await gap()

      // Category content parameters (what fields does a category need?)
      yandexProbes.push(await tryGet(
        'category-params-sample',
        `${YANDEX_API_BASE}/v2/category/90401/parameters`,
        headers,
      ))
      await gap()

      // Offer suggestions (for creating offers with correct category mapping)
      yandexProbes.push(await tryGet(
        'offer-suggestions',
        `${YANDEX_API_BASE}/v2/businesses/${yandexBusinessId}/offer-mappings/suggestions`,
        headers,
      ))
      await gap()
    }

    if (yandexCampaignId) {
      // Returns endpoints
      yandexProbes.push(await tryGet(
        'returns-list',
        `${YANDEX_API_BASE}/v2/campaigns/${yandexCampaignId}/returns?limit=5`,
        headers,
      ))
      await gap()

      // Order returns
      yandexProbes.push(await tryGet(
        'orders-returns',
        `${YANDEX_API_BASE}/v2/campaigns/${yandexCampaignId}/orders?status=RETURNED&limit=5`,
        headers,
      ))
      await gap()
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 3: Uzum — Probe return invoice endpoints directly
  // ══════════════════════════════════════════════════════════════════════════

  const uzumReturnProbes: ProbeResult[] = []
  if (uzumShop?.api_key_encrypted) {
    const uzumToken = decrypt(uzumShop.api_key_encrypted)
    const uzumHeaders = { Authorization: uzumToken.trim() }

    // Try return invoice endpoints found in spec
    for (const rp of uzumReturnPaths.filter(p => p.methods.includes('get')).slice(0, 6)) {
      uzumReturnProbes.push(await tryGet(
        `uzum-return: ${rp.path}`,
        `${UZUM_API_BASE}${rp.path}`.replace('{shopId}', uzumShop.shop_id_external ?? '0'),
        uzumHeaders,
      ))
      await gap()
    }
  }

  return NextResponse.json({
    ok: true,
    // ── Uzum findings ──
    uzum: {
      hasShop: !!uzumShop,
      totalSpecPaths: uzumAllPaths.length,
      allPathsByTag: uzumAllPaths.reduce((acc, p) => {
        const tag = p.tag ?? 'untagged'
        if (!acc[tag]) acc[tag] = []
        acc[tag].push({ path: p.path, methods: p.methods, summary: p.summary })
        return acc
      }, {} as Record<string, typeof uzumAllPaths>),
      productWritePaths: uzumProductPaths,
      returnPaths: uzumReturnPaths,
      returnProbes: uzumReturnProbes.map(p => ({
        label: p.label, status: p.status, ok: p.ok, body: p.bodySnippet,
      })),
    },
    // ── Yandex findings ──
    yandex: {
      hasShop: !!yandexShop,
      businessId: yandexBusinessId,
      campaignId: yandexCampaignId,
      probes: yandexProbes.map(p => ({
        label: p.label, status: p.status, ok: p.ok, body: p.bodySnippet,
      })),
    },
    hint: 'Look for: (1) Uzum POST/PUT product endpoints in productWritePaths, (2) Yandex offer-mappings/update 405 = exists but needs POST body, (3) Return Invoice paths with data.',
  })
})
