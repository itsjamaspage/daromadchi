import { NextResponse } from 'next/server'
import { eq, and, isNotNull } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_PUBLIC_BASE } from '@/lib/uzum/public'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 60

const BROWSER_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'uz-UZ,uz;q=0.9,ru;q=0.8,en;q=0.7',
  'Origin': 'https://uzum.uz',
  'Referer': 'https://uzum.uz/',
} as const

const GRAPHQL_HEADERS = {
  'Content-Type': 'application/json',
  ...BROWSER_HEADERS,
  'apollographql-client-name': 'web',
  'apollographql-client-version': '1.26.0',
} as const

function summariseArray(arr: unknown[], maxItems = 3): unknown[] {
  return arr.slice(0, maxItems).map(item => {
    if (!item || typeof item !== 'object') return item
    const obj = item as Record<string, unknown>
    const summary: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) summary[k] = `Array[${v.length}]`
      else if (v && typeof v === 'object') summary[k] = `Object{${Object.keys(v).join(',')}}`
      else summary[k] = v
    }
    return summary
  })
}

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop) return NextResponse.json({ ok: false, error: 'No Uzum shop' }, { status: 400 })

  const [sample] = await db.select({
    variant_group_key: products.variant_group_key,
    title: products.title,
  }).from(products)
    .where(and(
      eq(products.shop_id, shop.id),
      eq(products.is_archived, false),
      isNotNull(products.variant_group_key),
    ))
    .limit(1)

  const match = sample?.variant_group_key?.match(/^uzum:(\d+)$/)
  const productId = match ? Number(match[1]) : null

  if (!productId) {
    return NextResponse.json({ ok: false, error: 'No Uzum product with variant_group_key found' })
  }

  const results: Record<string, unknown> = { productId, title: sample?.title }

  // ── REST API: full response structure ──
  try {
    const res = await marketplaceFetch(`${UZUM_PUBLIC_BASE}/api/v2/product/${productId}`, {
      headers: BROWSER_HEADERS,
      cache: 'no-store',
    })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }

    if (json && typeof json === 'object') {
      const root = json as Record<string, unknown>
      const payload = root.payload as Record<string, unknown> | undefined
      const data = (payload?.data ?? root.data ?? root) as Record<string, unknown> | undefined

      // Find skuList/variants at various paths
      const skuPaths: Record<string, unknown> = {}
      const checkForSkus = (obj: Record<string, unknown>, path: string) => {
        for (const [k, v] of Object.entries(obj)) {
          const p = path ? `${path}.${k}` : k
          if (/^(skuList|variants|skus|configurations|offers)$/i.test(k) && Array.isArray(v)) {
            skuPaths[p] = {
              count: v.length,
              items: v.slice(0, 3).map((item: unknown) => {
                if (!item || typeof item !== 'object') return item
                const o = item as Record<string, unknown>
                const out: Record<string, unknown> = {}
                for (const [ik, iv] of Object.entries(o)) {
                  if (Array.isArray(iv)) {
                    out[ik] = { _type: 'array', length: iv.length, sample: summariseArray(iv, 2) }
                  } else if (iv && typeof iv === 'object') {
                    out[ik] = { _type: 'object', keys: Object.keys(iv) }
                  } else {
                    out[ik] = iv
                  }
                }
                return out
              }),
            }
          }
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            checkForSkus(v as Record<string, unknown>, p)
          }
        }
      }
      if (data) checkForSkus(data, '')

      // Also grab any photo-related fields at any level
      const photoFields: Record<string, unknown> = {}
      const walkPhotos = (obj: unknown, path: string, depth: number) => {
        if (depth > 6 || !obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) {
          obj.forEach((item, i) => walkPhotos(item, `${path}[${i}]`, depth + 1))
          return
        }
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const p = path ? `${path}.${k}` : k
          if (/photo|image|picture|gallery|media/i.test(k)) {
            if (Array.isArray(v)) photoFields[p] = { _array: v.length, sample: summariseArray(v, 2) }
            else photoFields[p] = v
          }
          if (typeof v === 'object' && v !== null) walkPhotos(v, p, depth + 1)
        }
      }
      walkPhotos(data, '', 0)

      results.rest = {
        status: res.status,
        topKeys: Object.keys(root),
        payloadKeys: payload ? Object.keys(payload) : null,
        dataKeys: data ? Object.keys(data) : null,
        skuPaths: Object.keys(skuPaths).length > 0 ? skuPaths : 'NONE',
        photoFields: Object.keys(photoFields).length > 0 ? photoFields : 'NONE',
      }
    } else {
      results.rest = { status: res.status, bodySnippet: text.slice(0, 500) }
    }
  } catch (e) {
    results.rest = { error: String(e).slice(0, 300) }
  }

  // ── GraphQL: makeProductPage with skuList ──
  try {
    const gql = `query ProductPage($id:Int!){makeProductPage(id:$id){
      photos{key link{high low}}
      skuList{
        id
        availableAmount
        fullPrice
        purchasePrice
        characteristics{title value}
        photos{key link{high low}}
        photo{key link{high low}}
        image
        previewImage
      }
    }}`
    const res = await marketplaceFetch('https://graphql.uzum.uz', {
      method: 'POST',
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({ operationName: 'ProductPage', query: gql, variables: { id: productId } }),
      cache: 'no-store',
    })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }

    if (json && typeof json === 'object') {
      const root = json as Record<string, unknown>
      const data = root.data as Record<string, unknown> | undefined
      const page = data?.makeProductPage as Record<string, unknown> | undefined
      const skuList = page?.skuList as Array<Record<string, unknown>> | undefined
      const photos = page?.photos

      results.graphql = {
        status: res.status,
        errors: root.errors ?? null,
        pageKeys: page ? Object.keys(page) : null,
        productPhotos: Array.isArray(photos) ? { count: photos.length, sample: summariseArray(photos, 2) } : photos,
        skuCount: skuList?.length ?? 0,
        skuSample: skuList ? skuList.slice(0, 3).map(sku => {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(sku)) {
            if (Array.isArray(v)) out[k] = { _array: v.length, sample: summariseArray(v, 2) }
            else if (v && typeof v === 'object') out[k] = { _type: 'object', keys: Object.keys(v) }
            else out[k] = v
          }
          return out
        }) : null,
      }
    } else {
      results.graphql = { status: res.status, bodySnippet: text.slice(0, 500) }
    }
  } catch (e) {
    results.graphql = { error: String(e).slice(0, 300) }
  }

  // ── GraphQL: try with wider field set ──
  try {
    const gql2 = `query ProductPage($id:Int!){makeProductPage(id:$id){
      skuList{
        id
        photos{key link{high low} photo{key link{high low}}}
        gallery{key link{high low}}
        characteristicValues{title value characteristicId}
      }
    }}`
    const res = await marketplaceFetch('https://graphql.uzum.uz', {
      method: 'POST',
      headers: GRAPHQL_HEADERS,
      body: JSON.stringify({ operationName: 'ProductPage', query: gql2, variables: { id: productId } }),
      cache: 'no-store',
    })
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }

    if (json && typeof json === 'object') {
      const root = json as Record<string, unknown>
      results.graphqlAlt = {
        status: res.status,
        errors: root.errors ?? null,
        data: root.data,
      }
    }
  } catch (e) {
    results.graphqlAlt = { error: String(e).slice(0, 200) }
  }

  return NextResponse.json({ ok: true, ...results })
})
