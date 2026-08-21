/**
 * Why does one Yandex SKU get its stock written and an identical-looking one
 * not? This prints the two keys the sync joins on, side by side.
 *
 * READ-ONLY. Two GET/POST reads the clients already make; no writes anywhere.
 *
 *   set -a; . ./.env; set +a
 *   npx tsx scripts/probe-yandex-stock-keys.ts KBBLK KBWHT
 *
 * ── The join being examined ─────────────────────────────────────────────────
 * lib/yandex/sync.ts builds stock like this:
 *
 *   stockMap.get(shopSku) ?? stockMap.get(marketSku) ?? … ?? null
 *
 * and the two sides come from DIFFERENT responses:
 *
 *   stockMap keys  ← /offers/stocks      `off.offerId` / `item.sku`, verbatim
 *   lookup key     ← /offer-mappings     skuOf(offer) = shopSku||offerId, TRIMMED
 *
 * Neither side is case-folded, and only one side is trimmed. A miss is silent:
 * the chain falls through to null, and null means "no data" downstream, which
 * preserves whatever the row already held — so a SKU that misses stays frozen
 * at its old value forever rather than erroring.
 *
 * This script prints both keys with their exact bytes so the difference — a
 * space, a case flip, a homoglyph, or a genuinely different identifier — is
 * visible rather than inferred.
 */
import { eq, and } from 'drizzle-orm'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { fetchAllYandexProducts, fetchYandexStocks } from '@/lib/yandex/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

const terms = process.argv.slice(2).filter(a => !a.startsWith('--'))

/** Show the exact bytes: quotes, escapes, and a length so a stray space shows. */
const show = (s: string | null | undefined) =>
  s == null ? 'null' : `${JSON.stringify(s)} (len ${s.length})`

async function main() {
  const [shop] = await db.select({
    id: shops.id, ext: shops.shop_id_external, enc: shops.api_key_encrypted,
  }).from(shops).where(and(
    eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true),
  ))
  if (!shop?.enc || !shop.ext) { console.log('No active Yandex shop with a token.'); process.exit(1) }
  const token = decrypt(shop.enc)

  // Side A — the catalog, which is what the sync iterates.
  const entries: any[] = await fetchAllYandexProducts(token, shop.ext)
  const skuOf = (o: any): string => (o?.shopSku && o.shopSku.trim()) || (o?.offerId && o.offerId.trim()) || ''

  // Side B — the stocks response, which is what the map is keyed from.
  const res: any = await fetchYandexStocks(token, shop.ext, [])
  const stockKeys = new Map<string, number>()
  const raw: string[] = []
  const take = (key: string, stocks: any[] | undefined) => {
    if (!key) return
    raw.push(key)
    stockKeys.set(key, (stocks ?? []).find(s => s?.type === 'FIT')?.count ?? 0)
  }
  for (const item of res?.result?.skus ?? []) take(item.sku ?? item.offerId ?? '', item.warehouseStocks ?? item.stocks)
  for (const w of res?.result?.warehouses ?? []) for (const off of w.offers ?? []) take(off.offerId ?? '', off.stocks)

  console.log(`\ncatalog entries: ${entries.length}   stock keys: ${stockKeys.size}`)
  console.log('If stock keys is much smaller than catalog entries, the stocks response is')
  console.log('paginated short and everything past it silently keeps its old value.\n')

  const wanted = entries.filter(e => {
    const s = `${skuOf(e.offer)} ${e.offer?.name ?? ''} ${e.mapping?.marketSku ?? ''}`.toLowerCase()
    return terms.length === 0 || terms.some(t => s.includes(t.toLowerCase()))
  })

  for (const e of wanted) {
    const lookup = skuOf(e.offer)
    const marketSku = e.mapping?.marketSku ? String(e.mapping.marketSku) : ''
    const hitShop = stockKeys.has(lookup)
    const hitMarket = marketSku ? stockKeys.has(marketSku) : false
    // The same comparison the sync makes, plus the near-miss that explains it.
    const loose = raw.find(k => k !== lookup && k.trim().toLowerCase() === lookup.trim().toLowerCase())
    console.log('─'.repeat(72))
    console.log(`  catalog shopSku (lookup key): ${show(lookup)}`)
    console.log(`  catalog marketSku           : ${show(marketSku)}`)
    console.log(`  stockMap hit on shopSku     : ${hitShop ? `YES → FIT=${stockKeys.get(lookup)}` : 'NO'}`)
    console.log(`  stockMap hit on marketSku   : ${hitMarket ? `YES → FIT=${stockKeys.get(marketSku)}` : 'NO'}`)
    if (!hitShop && !hitMarket) {
      console.log(`  → stock resolves to null, so the sync SKIPS the write and the row keeps its old value.`)
      if (loose) console.log(`  → NEAR MISS: stocks response has ${show(loose)} — differs only by case/whitespace.`)
      else console.log(`  → No near miss either: this offer is absent from the stocks response entirely.`)
    }
  }
  console.log('─'.repeat(72))
  console.log(`\nSample of stock-response keys: ${raw.slice(0, 8).map(k => JSON.stringify(k)).join(', ')}\n`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
