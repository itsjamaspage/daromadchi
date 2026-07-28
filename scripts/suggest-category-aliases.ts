import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { products, categoryAliases, categoriesCanonical, suggestedAliases } from '@/lib/db/schema'
import { matchCategory } from '@/lib/categories/matcher'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
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

  for (const { category, marketplace } of unmatched) {
    const result = matchCategory(category)
    if (!result) {
      noMatch++
      continue
    }

    const [canonical] = await db
      .select({ id: categoriesCanonical.id })
      .from(categoriesCanonical)
      .where(eq(categoriesCanonical.slug, result.canonical_id))
      .limit(1)

    if (!canonical) {
      noMatch++
      continue
    }

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

    matched++
  }

  console.log(`Suggested ${matched} aliases, ${noMatch} had no match`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
