import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { products, categoryAliases, categoriesCanonical, suggestedAliases } from '@/lib/db/schema'
import { matchCategory } from '@/lib/categories/matcher'

const dryRun = process.argv.includes('--dry-run')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  if (dryRun) console.log('=== DRY RUN — nothing will be written ===\n')

  const rows = await db.execute(sql`
    SELECT DISTINCT p.category, s.marketplace
    FROM ${products} p
    JOIN shops s ON s.id = p.shop_id
    LEFT JOIN ${categoryAliases} ca
      ON ca.original_name = p.category AND ca.marketplace = s.marketplace::text
    LEFT JOIN ${suggestedAliases} sa
      ON sa.original_name = p.category AND sa.marketplace = s.marketplace::text
    WHERE p.category IS NOT NULL
      AND ca.id IS NULL
      AND sa.id IS NULL
  `)

  const unmatched = rows.rows as { category: string; marketplace: string }[]
  console.log(`Found ${unmatched.length} unmatched category/marketplace pairs`)

  let matched = 0
  let noMatch = 0
  const bands: Record<string, { tier: string; canonical: string; raw: string; mp: string }[]> = {
    '1.00': [], '0.85': [], '0.70-0.80': [], '0.50-0.69': [],
  }

  for (const { category, marketplace } of unmatched) {
    const result = matchCategory(category)
    if (!result) {
      noMatch++
      continue
    }

    const [canonical] = await db
      .select({ id: categoriesCanonical.id, slug: categoriesCanonical.slug })
      .from(categoriesCanonical)
      .where(eq(categoriesCanonical.slug, result.canonical_id))
      .limit(1)

    if (!canonical) {
      noMatch++
      continue
    }

    const entry = { tier: result.tier, canonical: canonical.slug, raw: category, mp: marketplace }
    if (result.score === 1.0) bands['1.00'].push(entry)
    else if (result.score === 0.85) bands['0.85'].push(entry)
    else if (result.score >= 0.7) bands['0.70-0.80'].push(entry)
    else bands['0.50-0.69'].push(entry)

    if (!dryRun) {
      await db
        .insert(suggestedAliases)
        .values({
          canonical_id: canonical.id,
          marketplace,
          original_name: category,
          score: String(result.score),
          tier: result.tier,
        })
        .onConflictDoNothing()
    }

    matched++
  }

  console.log(`\n${dryRun ? 'Would suggest' : 'Suggested'} ${matched} aliases, ${noMatch} had no match\n`)

  console.log('Score band breakdown:')
  for (const [band, entries] of Object.entries(bands)) {
    console.log(`  ${band}: ${entries.length} suggestions`)
    if (dryRun) {
      for (const e of entries.slice(0, 10)) {
        console.log(`    [${e.mp}] "${e.raw}" → ${e.canonical} (${e.tier})`)
      }
      if (entries.length > 10) console.log(`    ... and ${entries.length - 10} more`)
    }
  }

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
