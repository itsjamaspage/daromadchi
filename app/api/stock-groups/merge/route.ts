import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db, productGroupMerges } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

// POST /api/stock-groups/merge — merge two stock groups
// { source_key: string, target_key: string }
export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sourceKey = typeof body.source_key === 'string' ? body.source_key.trim() : ''
  const targetKey = typeof body.target_key === 'string' ? body.target_key.trim() : ''
  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return NextResponse.json({ error: 'source_key and target_key required and must differ' }, { status: 400 })
  }

  await db.insert(productGroupMerges).values({
    user_id: userId,
    source_key: sourceKey,
    target_key: targetKey,
  }).onConflictDoUpdate({
    target: [productGroupMerges.user_id, productGroupMerges.source_key],
    set: { target_key: targetKey, created_at: new Date() },
  })

  return NextResponse.json({ ok: true })
})

// DELETE /api/stock-groups/merge — unmerge a stock group
// { source_key: string }
export const DELETE = withErrorHandler(async (req: Request) => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sourceKey = typeof body.source_key === 'string' ? body.source_key.trim() : ''
  if (!sourceKey) return NextResponse.json({ error: 'source_key required' }, { status: 400 })

  await db.delete(productGroupMerges).where(
    and(eq(productGroupMerges.user_id, userId), eq(productGroupMerges.source_key, sourceKey)),
  )

  return NextResponse.json({ ok: true })
})
