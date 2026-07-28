import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { categoriesCanonical, categoryAliases } from '@/lib/db/schema'
import { TAXONOMY } from '@/lib/categories/taxonomy'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  let canonicalsInserted = 0
  let canonicalsUpdated = 0
  let aliasesInserted = 0
  let skipped = 0

  await db.transaction(async (tx) => {
    for (const cat of TAXONOMY) {
      const [row] = await tx
        .insert(categoriesCanonical)
        .values({
          slug: cat.id,
          name_ru: cat.name.ru,
          name_uz: cat.name.uz,
          name_en: cat.name.en,
        })
        .onConflictDoNothing()
        .returning({ id: categoriesCanonical.id })

      let canonicalId: number
      if (row) {
        canonicalId = row.id
        canonicalsInserted++
      } else {
        const existing = await tx
          .select({ id: categoriesCanonical.id })
          .from(categoriesCanonical)
          .where(eq(categoriesCanonical.slug, cat.id))
          .limit(1)

        if (existing.length === 0) {
          const byName = await tx
            .select({ id: categoriesCanonical.id })
            .from(categoriesCanonical)
            .where(eq(categoriesCanonical.name_ru, cat.name.ru))
            .limit(1)

          if (byName.length === 0) {
            skipped++
            continue
          }
          canonicalId = byName[0].id
          await tx
            .update(categoriesCanonical)
            .set({ slug: cat.id, name_uz: cat.name.uz, name_en: cat.name.en })
            .where(eq(categoriesCanonical.id, canonicalId))
          canonicalsUpdated++
        } else {
          canonicalId = existing[0].id
        }
      }

      for (const mp of ['uzum', 'wildberries', 'yandex_market'] as const) {
        for (const raw of cat.raw_examples[mp]) {
          const [a] = await tx
            .insert(categoryAliases)
            .values({ canonical_id: canonicalId, marketplace: mp, original_name: raw })
            .onConflictDoNothing()
            .returning({ id: categoryAliases.id })
          if (a) aliasesInserted++
          else skipped++
        }
      }
    }
  })

  console.log(
    `Seeded ${canonicalsInserted} new canonicals, updated ${canonicalsUpdated}, inserted ${aliasesInserted} aliases (skipped ${skipped} existing).`,
  )
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
