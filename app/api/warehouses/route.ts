import { NextResponse } from 'next/server'
import { eq, ne, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, warehouses, shops } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [warehouseRows, shopRows] = await Promise.all([
    db.select({
      id: warehouses.id,
      name: warehouses.name,
      created_at: warehouses.created_at,
    }).from(warehouses)
      .where(eq(warehouses.user_id, user.id))
      .orderBy(warehouses.created_at),
    db.select({
      id: shops.id,
      name: shops.name,
      marketplace: shops.marketplace,
      warehouse_id: shops.warehouse_id,
    }).from(shops)
      .where(and(eq(shops.user_id, user.id), ne(shops.shop_id_external, 'DEMO'))),
  ])

  return NextResponse.json({ warehouses: warehouseRows, shops: shopRows })
})

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const [warehouse] = await db.insert(warehouses).values({
    user_id: user.id,
    name: name.trim(),
  }).returning({
    id: warehouses.id,
    name: warehouses.name,
    created_at: warehouses.created_at,
  })

  return NextResponse.json({ warehouse })
})

export const DELETE = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db.delete(warehouses)
    .where(and(eq(warehouses.id, id), eq(warehouses.user_id, user.id)))

  return NextResponse.json({ ok: true })
})
