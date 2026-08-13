/**
 * READ-ONLY feasibility probe for colour-attribute enrichment (option 3).
 *
 * Question it answers: does the marketplace API expose the seller-set colour
 * attribute for a product whose NAME has no colour word (e.g. the J16 earphones),
 * and under exactly what field? Our sync only infers colour from the name via
 * resolveColor(); this dumps the richer per-marketplace payloads so we can see if
 * a structured colour exists and wire it in.
 *
 * Run on the VPS (needs DATABASE_URL + real seller tokens + outbound access):
 *   tsx scripts/probe-color-attributes.ts JMJ16BG
 *
 * It performs ONLY reads:
 *   • Yandex — POST /v2/businesses/{businessId}/offer-cards  (POST is Yandex's
 *     READ method for cards, same family as offer-mappings). Dumps parameterValues.
 *   • Uzum   — GET  /v1/product/shop/{shopId}. Dumps the full card + SKU JSON.
 * No writes, no stock changes, no status changes.
 */
import { eq, ilike } from 'drizzle-orm'
import { db, shops, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { fetchCampaignInfo } from '@/lib/yandex/client'
import { fetchUzumShops, fetchUzumShopProducts } from '@/lib/uzum/client'

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru'

const sku = (process.argv[2] ?? '').trim()
if (!sku) {
  console.error('Usage: tsx scripts/probe-color-attributes.ts <SKU>   e.g. JMJ16BG')
  process.exit(1)
}

function tokenOf(apiKeyEncrypted: string | null): string | null {
  if (!apiKeyEncrypted) return null
  try { return decrypt(apiKeyEncrypted) } catch { return null }
}

async function probeYandex(token: string, campaignId: string, businessId: string | null) {
  let bId = businessId
  if (!bId) {
    try { bId = String((await fetchCampaignInfo(token, campaignId)).businessId) } catch (e) {
      console.error('  · could not resolve businessId:', String(e).slice(0, 200)); return
    }
  }
  // POST offer-cards for just this offer. Read-only (POST is YM's read verb here).
  const res = await fetch(`${YANDEX_API_BASE}/v2/businesses/${bId}/offer-cards`, {
    method: 'POST',
    headers: { 'Api-Key': token, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ offerIds: [sku] }),
  })
  const text = await res.text()
  console.log(`  · offer-cards HTTP ${res.status}`)
  if (!res.ok) { console.log('  · body:', text.slice(0, 600)); return }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- diagnostic: dump arbitrary API shape
  let json: Record<string, any>
  try { json = JSON.parse(text) } catch { console.log('  · non-JSON body:', text.slice(0, 400)); return }
  const cards = json?.result?.offerCards ?? json?.result?.offerCardsList ?? []
  if (!cards.length) { console.log('  · no offerCards returned. Raw result keys:', Object.keys(json?.result ?? json ?? {})); return }
  for (const c of cards) {
    console.log(`  · offerId=${c.offerId ?? c.mapping?.marketSku ?? '?'}  name="${c.name ?? c.mapping?.marketSkuName ?? ''}"`)
    const pv = c.parameterValues ?? c.parameters ?? []
    if (!pv.length) { console.log('    (no parameterValues — colour attr not returned here)') ; continue }
    // Dump EVERY parameter so we can see how «Цвет» is represented (id vs name, value text vs valueId).
    for (const p of pv) console.log('    param:', JSON.stringify(p))
  }
}

async function probeUzum(token: string) {
  const uzumShops = await fetchUzumShops(token)
  for (const ush of uzumShops) {
    for (let page = 0; page < 25; page++) {
      const resp = await fetchUzumShopProducts(token, ush.id, page, 100)
      const cards = resp?.productList ?? []
      if (!cards.length) break
      for (const card of cards) {
        const hit = (card.skuList ?? []).find(s =>
          [s.article, s.sellerItemCode, s.skuTitle, card.title].some(v =>
            v && String(v).toLowerCase().includes(sku.toLowerCase())))
        if (hit) {
          console.log(`  · MATCH card productId=${card.productId} title="${card.title ?? ''}"`)
          console.log('    FULL card JSON (look for any colour/цвет/characteristic field):')
          console.log(JSON.stringify(card, null, 2))
          return
        }
      }
      if (cards.length < 100) break
    }
  }
  console.log('  · no matching Uzum card found in the first pages.')
}

async function main() {
  const rows = await db
    .select({
      shop_id: products.shop_id, sku: products.sku, title: products.title,
      variant_color: products.variant_color,
      marketplace: shops.marketplace, shop_name: shops.name,
      api_key_encrypted: shops.api_key_encrypted, shop_id_external: shops.shop_id_external,
      business_id: shops.business_id,
    })
    .from(products)
    .innerJoin(shops, eq(shops.id, products.shop_id))
    .where(ilike(products.sku, `%${sku}%`))

  if (!rows.length) { console.error(`No products matched SKU ~ "${sku}".`); process.exit(1) }

  for (const r of rows) {
    console.log(`\n=== ${r.marketplace} · ${r.shop_name} · sku=${r.sku} · current variant_color=${r.variant_color ?? 'NULL'} ===`)
    const token = tokenOf(r.api_key_encrypted)
    if (!token) { console.log('  · no usable token for this shop; skipping.'); continue }
    try {
      if (r.marketplace === 'yandex_market') {
        if (!r.shop_id_external) { console.log('  · no campaignId (shop_id_external); skipping.'); continue }
        await probeYandex(token, r.shop_id_external, r.business_id ?? null)
      } else if (r.marketplace === 'uzum') {
        await probeUzum(token)
      }
    } catch (e) {
      console.error('  · probe error:', String(e).slice(0, 300))
    }
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
