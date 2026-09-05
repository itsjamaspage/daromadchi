import { NextResponse } from 'next/server'
import { eq, and, isNull, isNotNull, count, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { UZUM_PUBLIC_BASE, fetchProductPhoto } from '@/lib/uzum/public'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 120

// GET — diagnostic probe (unchanged from before)
export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const mpSplit = await db.select({
    marketplace: shops.marketplace,
    total: count(),
    with_photo: sql<number>`count(${products.image_url})`.as('with_photo'),
  })
    .from(products)
    .innerJoin(shops, eq(products.shop_id, shops.id))
    .where(and(
      eq(shops.user_id, user.id),
      eq(shops.is_active, true),
      eq(products.is_archived, false),
    ))
    .groupBy(shops.marketplace)

  const marketplaceSplit = mpSplit.map(r => ({
    marketplace: r.marketplace,
    total: r.total,
    with_photo: r.with_photo,
    without_photo: r.total - r.with_photo,
  }))

  const [shop] = await db.select({
    id: shops.id,
    api_key_encrypted: shops.api_key_encrypted,
  }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({
      ok: true,
      marketplaceSplit,
      error: 'Uzum shop/token topilmadi — only marketplace split returned',
    })
  }

  const token = decrypt(shop.api_key_encrypted)

  let sellerPhotos: unknown = null
  let sellerShopId: number | null = null
  try {
    const shopsRes = await marketplaceFetch(`${UZUM_API_BASE}/v1/shops`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    const shopsData = await shopsRes.json().catch(() => null)
    const arr = Array.isArray(shopsData) ? shopsData : (shopsData?.shops ?? shopsData?.data ?? [])
    sellerShopId = (arr as { id: number }[])[0]?.id ?? null
  } catch (e) {
    sellerPhotos = { error: `shops: ${String(e).slice(0, 200)}` }
  }

  if (sellerShopId && !sellerPhotos) {
    try {
      const res = await marketplaceFetch(
        `${UZUM_API_BASE}/v1/product/shop/${sellerShopId}?page=0&size=5&filter=ALL&sortBy=DEFAULT&order=ASC`,
        { headers: { Authorization: token.trim(), Accept: 'application/json' }, next: { revalidate: 0 } },
      )
      const text = await res.text()
      const data = JSON.parse(text)
      const cards = data?.productList ?? []
      sellerPhotos = {
        httpStatus: res.status,
        cardCount: cards.length,
        cards: (cards as Record<string, unknown>[]).slice(0, 3).map((card) => ({
          productId: card.productId,
          title: card.title,
          hasPhotosField: 'photos' in card,
          photosType: card.photos === undefined ? 'undefined'
            : card.photos === null ? 'null'
            : Array.isArray(card.photos) ? `array[${(card.photos as unknown[]).length}]`
            : typeof card.photos,
          photosRaw: card.photos,
          allTopLevelKeys: Object.keys(card),
        })),
      }
    } catch (e) {
      sellerPhotos = { error: `products: ${String(e).slice(0, 300)}` }
    }
  }

  const [dbProductWithGroup] = await db.select({
    variant_group_key: products.variant_group_key,
    title: products.title,
    image_url: products.image_url,
  }).from(products)
    .where(and(
      eq(products.shop_id, shop.id),
      eq(products.is_archived, false),
      isNotNull(products.variant_group_key),
    ))
    .limit(1)

  let publicApiProbe: unknown = null
  const groupKey = dbProductWithGroup?.variant_group_key
  const match = groupKey?.match(/^uzum:(\d+)$/)
  const testProductId = match ? Number(match[1]) : null

  if (testProductId) {
    try {
      const rawRes = await marketplaceFetch(`${UZUM_PUBLIC_BASE}/api/v2/product/${testProductId}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': 'https://uzum.uz',
          'Referer': 'https://uzum.uz/',
          'Accept-Language': 'uz-UZ,uz;q=0.9,ru;q=0.8,en;q=0.7',
        },
        cache: 'no-store',
      })
      const rawText = await rawRes.text()
      let rawJson: unknown = null
      try { rawJson = JSON.parse(rawText) } catch { /* not JSON */ }

      const photoFields: Record<string, unknown> = {}
      const walk = (obj: unknown, path: string, depth: number) => {
        if (depth > 5 || !obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) return
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const p = path ? `${path}.${k}` : k
          if (/photo|image|picture|gallery|media/i.test(k)) {
            photoFields[p] = v
          }
          if (typeof v === 'object' && v !== null && depth < 5) {
            walk(v, p, depth + 1)
          }
        }
      }
      walk(rawJson, '', 0)

      const payload = (rawJson as Record<string, unknown>)?.payload as Record<string, unknown> | undefined
      const dataObj = payload?.data as Record<string, unknown> | undefined
      const photosAtExpectedPath = dataObj?.photos

      publicApiProbe = {
        httpStatus: rawRes.status,
        testProductId,
        bodyLength: rawText.length,
        bodySnippet: rawText.slice(0, 500),
        topLevelKeys: rawJson && typeof rawJson === 'object' ? Object.keys(rawJson) : null,
        payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
        dataKeys: dataObj && typeof dataObj === 'object' ? Object.keys(dataObj) : null,
        photosAtExpectedPath: photosAtExpectedPath === undefined ? 'MISSING'
          : photosAtExpectedPath === null ? 'null'
          : Array.isArray(photosAtExpectedPath) ? { count: photosAtExpectedPath.length, first: photosAtExpectedPath[0] }
          : typeof photosAtExpectedPath,
        allPhotoFields: Object.keys(photoFields).length > 0 ? photoFields : 'NONE FOUND',
      }
    } catch (e) {
      publicApiProbe = { error: String(e).slice(0, 300), testProductId }
    }

    let fetchResult: unknown = null
    try {
      const url = await fetchProductPhoto(testProductId)
      fetchResult = { returned: url }
    } catch (e) {
      fetchResult = { error: String(e).slice(0, 200) }
    }
    publicApiProbe = { ...publicApiProbe as Record<string, unknown>, fetchProductPhotoResult: fetchResult }

    if (fetchResult && typeof (fetchResult as Record<string, unknown>).returned === 'string') {
      const cdnUrl = (fetchResult as Record<string, unknown>).returned as string
      try {
        const cdnRes = await fetch(cdnUrl, { method: 'HEAD' })
        publicApiProbe = {
          ...publicApiProbe as Record<string, unknown>,
          cdnCheck: {
            url: cdnUrl,
            status: cdnRes.status,
            contentType: cdnRes.headers.get('content-type'),
            reachable: cdnRes.ok,
          },
        }
      } catch (e) {
        publicApiProbe = {
          ...publicApiProbe as Record<string, unknown>,
          cdnCheck: { url: cdnUrl, error: String(e).slice(0, 200) },
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    marketplaceSplit,
    sellerApiPhotos: sellerPhotos,
    publicApiPhotos: publicApiProbe,
  })
})

// POST — backfill photos for all Uzum products missing them.
// Does the API calls directly (not through fetchProductPhoto) so every
// step is visible in the response for debugging.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))

  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Uzum shop topilmadi' }, { status: 400 })
  }

  const missing = await db.select({
    id: products.id,
    variant_group_key: products.variant_group_key,
    title: products.title,
  })
    .from(products)
    .where(and(
      eq(products.shop_id, shop.id),
      eq(products.is_archived, false),
      isNull(products.image_url),
      isNotNull(products.variant_group_key),
    ))

  const byProductId = new Map<number, { dbIds: string[]; title: string }>()
  for (const p of missing) {
    const m = p.variant_group_key?.match(/^uzum:(\d+)$/)
    if (!m) continue
    const pid = Number(m[1])
    const existing = byProductId.get(pid)
    if (existing) existing.dbIds.push(p.id)
    else byProductId.set(pid, { dbIds: [p.id], title: p.title ?? '' })
  }

  if (byProductId.size === 0) {
    return NextResponse.json({ ok: true, message: 'All Uzum products already have photos', filled: 0, total: 0 })
  }

  const results: Record<string, unknown>[] = []
  let filled = 0

  for (const [productId, { dbIds, title }] of byProductId) {
    if (results.length > 0) await new Promise(r => setTimeout(r, 1200))

    const entry: Record<string, unknown> = { productId, title: title.slice(0, 60), dbIds }

    // ── Step 1: REST public API ──
    try {
      const restUrl = `${UZUM_PUBLIC_BASE}/api/v2/product/${productId}`
      const restRes = await marketplaceFetch(restUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://uzum.uz',
          'Referer': 'https://uzum.uz/',
        },
        cache: 'no-store',
      })
      const restText = await restRes.text()
      entry.rest = { status: restRes.status, bodyLength: restText.length, snippet: restText.slice(0, 300) }

      if (restRes.ok) {
        try {
          const json = JSON.parse(restText) as Record<string, unknown>
          const payload = json.payload as Record<string, unknown> | undefined
          const dataObj = payload?.data as Record<string, unknown> | undefined
          const photos = dataObj?.photos ?? (payload as Record<string, unknown> | undefined)?.photos ?? json.photos
          entry.rest = { ...entry.rest as Record<string, unknown>, photosFound: photos !== undefined, photosType: photos === undefined ? 'undefined' : photos === null ? 'null' : Array.isArray(photos) ? `array[${photos.length}]` : typeof photos }

          if (Array.isArray(photos) && photos.length > 0) {
            const p = photos[0] as Record<string, unknown>
            const link = p.link as Record<string, string> | undefined
            const photoUrl = link?.high ?? link?.low
              ?? (p.photoKey ? `https://images.uzum.uz/${p.photoKey}/t_product_540_high.jpg` : null)
              ?? (p.key ? `https://images.uzum.uz/${p.key}/t_product_540_high.jpg` : null)
            if (photoUrl) {
              entry.url = photoUrl
              entry.source = 'rest'
            }
            entry.firstPhoto = p
          }
        } catch (parseErr) {
          entry.rest = { ...entry.rest as Record<string, unknown>, parseError: String(parseErr).slice(0, 200) }
        }
      }
    } catch (restErr) {
      entry.rest = { error: String(restErr).slice(0, 300) }
    }

    // ── Step 2: GraphQL fallback ──
    if (!entry.url) {
      try {
        const gql = `query ProductPage($id:Int!){makeProductPage(id:$id){photos{key link{high low}}}}`
        const gqlRes = await marketplaceFetch('https://graphql.uzum.uz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://uzum.uz',
            'Referer': 'https://uzum.uz/',
            'apollographql-client-name': 'web',
            'apollographql-client-version': '1.26.0',
          },
          body: JSON.stringify({ operationName: 'ProductPage', query: gql, variables: { id: productId } }),
          cache: 'no-store',
        })
        const gqlText = await gqlRes.text()
        entry.graphql = { status: gqlRes.status, bodyLength: gqlText.length, snippet: gqlText.slice(0, 400) }

        if (gqlRes.ok) {
          try {
            const data = JSON.parse(gqlText) as { data?: { makeProductPage?: { photos?: Array<{ key?: string; link?: { high?: string; low?: string } }> } }; errors?: unknown }
            const photos = data?.data?.makeProductPage?.photos
            entry.graphql = { ...entry.graphql as Record<string, unknown>, photosCount: photos?.length ?? 0, errors: data.errors }

            if (photos && photos.length > 0) {
              const p = photos[0]
              const photoUrl = p.link?.high ?? p.link?.low
                ?? (p.key ? `https://images.uzum.uz/${p.key}/t_product_540_high.jpg` : null)
              if (photoUrl) {
                entry.url = photoUrl
                entry.source = 'graphql'
              }
              entry.firstGqlPhoto = p
            }
          } catch (parseErr) {
            entry.graphql = { ...entry.graphql as Record<string, unknown>, parseError: String(parseErr).slice(0, 200) }
          }
        }
      } catch (gqlErr) {
        entry.graphql = { error: String(gqlErr).slice(0, 300) }
      }
    }

    // ── Step 3: Write to DB if we got a URL ──
    if (typeof entry.url === 'string' && entry.url) {
      filled++
      await db.update(products)
        .set({ image_url: entry.url as string })
        .where(
          and(
            eq(products.shop_id, shop.id),
            isNull(products.image_url),
            sql`${products.id} = ANY(${sql`string_to_array(${dbIds.join(',')}, ',')::uuid[]`})`,
          ),
        )
      entry.written = true
    }

    results.push(entry)
  }

  return NextResponse.json({
    ok: true,
    message: `Backfilled ${filled}/${byProductId.size} products`,
    filled,
    total: byProductId.size,
    details: results,
  })
})
