import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { products, categoryAliases, suggestedProductGroups } from '@/lib/db/schema'
import { normalizeKey } from '@/lib/db/stock-groups'
import { suggestGroups, type SuggesterProduct } from '@/lib/products/group-suggester'

// Mirrors scripts/suggest-category-aliases.ts. Generates READ-ONLY "product group"
// suggestions: cross-marketplace pairs that look like the same physical product.
// --dry-run prints candidates and inserts NOTHING. Never merges anything.
//   npm run products:suggest -- --dry-run
const dryRun = process.argv.includes('--dry-run')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  if (dryRun) console.log('=== DRY RUN — nothing will be written ===\n')

  // Every product with its shop's marketplace + owner, plus the resolved canonical
  // category (via category_aliases) when one exists.
  const res = await db.execute(sql`
    SELECT p.id, p.sku, p.title, p.category, p.selling_price, p.market_barcode,
           p.shop_id, s.user_id, s.marketplace::text AS marketplace, ca.canonical_id
    FROM ${products} p
    JOIN shops s ON s.id = p.shop_id
    LEFT JOIN ${categoryAliases} ca
      ON ca.original_name = p.category AND ca.marketplace = s.marketplace::text
  `)
  const raw = res.rows as Array<{
    id: string; sku: string | null; title: string; category: string | null
    selling_price: string | null; market_barcode: string | null
    shop_id: string; user_id: string; marketplace: string; canonical_id: number | null
  }>

  const byUser = new Map<string, SuggesterProduct[]>()
  for (const r of raw) {
    const list = byUser.get(r.user_id) ?? []
    list.push({
      id: r.id,
      shopId: r.shop_id,
      marketplace: r.marketplace,
      matchKey: r.sku ? normalizeKey(r.sku) : `#${r.id}`,
      sku: r.sku,
      title: r.title,
      category: r.category,
      canonicalCategoryId: r.canonical_id ?? null,
      price: r.selling_price != null ? Number(r.selling_price) : null,
      barcode: r.market_barcode,
    })
    byUser.set(r.user_id, list)
  }

  let totalCandidates = 0
  let inserted = 0
  const samples: string[] = []

  for (const [userId, prods] of byUser) {
    const cands = suggestGroups(prods)
    totalCandidates += cands.length
    const info = new Map(prods.map(p => [p.id, { title: p.title, mp: p.marketplace }]))

    for (const c of cands) {
      if (samples.length < 12) {
        const a = info.get(c.aProductId)!, b = info.get(c.bProductId)!
        const s = c.signals
        samples.push(
          `  ${c.score.toFixed(3)} ${c.tier.padEnd(6)}  [${a.mp}] ${a.title}  ⇄  [${b.mp}] ${b.title}\n` +
          `         color=${s.colorA}/${s.colorB}(match=${s.colorMatch}) cat=${s.categoryMatch} titleSim=${s.titleSim} price×${s.priceRatio ?? '—'}(ok=${s.priceOk}) barcode=${s.barcodeMatch}`,
        )
      }
      if (!dryRun) {
        await db.insert(suggestedProductGroups).values({
          user_id: userId,
          a_match_key: c.aMatchKey,
          b_match_key: c.bMatchKey,
          a_product_id: c.aProductId,
          b_product_id: c.bProductId,
          score: String(c.score),
          tier: c.tier,
          signals: c.signals,
        }).onConflictDoNothing()
        inserted++
      }
    }
  }

  console.log(`Users: ${byUser.size}   |   candidate pairs: ${totalCandidates}\n`)
  console.log('Top sample candidates:')
  console.log(samples.join('\n') || '  (none)')
  console.log(`\n${dryRun ? 'Would insert' : 'Inserted'} ${dryRun ? totalCandidates : inserted} suggestions.`)

  await pool.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
