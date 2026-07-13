import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopId, warehouseId } = await req.json()
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

  await db.update(shops)
    .set({ warehouse_id: warehouseId ?? null })
    .where(and(eq(shops.id, shopId), eq(shops.user_id, user.id)))

  return NextResponse.json({ ok: true })
})
