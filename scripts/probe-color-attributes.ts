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
 *   • Uzum   — GET  /v1/product/shop/{shopId}. Dumps the full card + SKU JSON.
 * No writes, no stock changes, no status changes.
 */
import { eq, ilike } from 'drizzle-orm'
import { db, shops, products } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { fetchUzumShops, fetchUzumShopProducts } from '@/lib/uzum/client'

const sku = (process.argv[2] ?? '').trim()
if (!sku) {
  console.error('Usage: tsx scripts/probe-color-attributes.ts <SKU>   e.g. JMJ16BG')
  process.exit(1)
}

function tokenOf(apiKeyEncrypted: string | null): string | null {
  if (!apiKeyEncrypted) return null
  try { return decrypt(apiKeyEncrypted) } catch { return null }
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
      if (r.marketplace === 'uzum') {
        await probeUzum(token)
      }
    } catch (e) {
      console.error('  · probe error:', String(e).slice(0, 300))
    }
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
