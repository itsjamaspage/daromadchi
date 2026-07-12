import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db, productLinks } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { getStockGroups } from '@/lib/db/stock-groups'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

// GET /api/stock-groups — aggregated cross-marketplace leftover groups
export const GET = withErrorHandler(async () => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const groups = await getStockGroups()
  return NextResponse.json({ groups })
})

// PATCH /api/stock-groups
// { match_key: string, total_physical_stock?: number | null, stock_threshold?: number | null }
// Setting total_physical_stock (re)starts the baseline: leftover counts down
// from this number as units sell on any marketplace. null switches the group
// back to api mode (sum of marketplace-reported stocks).
export const PATCH = withErrorHandler(async (req: Request) => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const matchKey: string = typeof body.match_key === 'string' ? body.match_key.trim() : ''
  if (!matchKey) return NextResponse.json({ error: 'match_key required' }, { status: 400 })

  const hasStock = 'total_physical_stock' in body
  const hasThreshold = 'stock_threshold' in body
  if (!hasStock && !hasThreshold) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const stockVal: number | null = hasStock ? body.total_physical_stock : null
  if (hasStock && stockVal !== null && (!Number.isInteger(stockVal) || stockVal < 0)) {
    return NextResponse.json({ error: 'total_physical_stock must be a non-negative integer' }, { status: 400 })
  }
  const thresholdVal: number | null = hasThreshold ? body.stock_threshold : null
  if (hasThreshold && thresholdVal !== null && (!Number.isInteger(thresholdVal) || thresholdVal < 0)) {
    return NextResponse.json({ error: 'stock_threshold must be a non-negative integer' }, { status: 400 })
  }

  const existing = await db.select({ id: productLinks.id })
    .from(productLinks)
    .where(and(eq(productLinks.user_id, userId), eq(productLinks.match_key, matchKey)))
    .limit(1)

  const patch: Record<string, unknown> = { updated_at: new Date() }
  if (hasStock) {
    patch.total_physical_stock = stockVal
    patch.baseline_at = stockVal === null ? null : new Date()
  }
  if (hasThreshold) patch.stock_threshold = thresholdVal

  if (existing.length > 0) {
    await db.update(productLinks).set(patch).where(eq(productLinks.id, existing[0].id))
  } else {
    await db.insert(productLinks).values({
      user_id: userId,
      match_key: matchKey,
      total_physical_stock: hasStock ? stockVal : null,
      baseline_at: hasStock && stockVal !== null ? new Date() : null,
      stock_threshold: hasThreshold ? thresholdVal : null,
    })
  }

  return NextResponse.json({ ok: true })
})
