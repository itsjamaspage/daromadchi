import { isNull, eq } from 'drizzle-orm'
import { db, products } from '@/lib/db'
import { resolveWithFallback } from './resolve'

export async function backfillProductCategories(): Promise<number> {
  const uncategorized = await db.select({
    id: products.id,
    title: products.title,
  }).from(products).where(isNull(products.category))

  let updated = 0
  for (const p of uncategorized) {
    const resolved = resolveWithFallback(null, p.title)
    if (resolved) {
      await db.update(products).set({
        category: resolved.name_ru,
        updated_at: new Date(),
      }).where(eq(products.id, p.id))
      updated++
    }
  }
  return updated
}
