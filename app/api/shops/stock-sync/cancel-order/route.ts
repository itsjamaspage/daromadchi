import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, orders } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { cancelOrder } from '@/lib/marketplace/order-cancel'
import { userHasFeature } from '@/lib/billing/entitlement'
import type { MarketplaceType } from '@/lib/types'

const Schema = z.object({ orderId: z.string().uuid() })

// One-click (human-in-the-loop) oversell cancel: cancels a real order the caller
// owns, reason OUT_OF_STOCK. auto=false → never rate-limited. Always live (a
// human explicitly asked); the writer's kill switch still applies.
export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // The oversell cancel belongs to stock-sync, so it follows the same plan gate
  // as the write-back that produces the oversell. Refusing here can only ever
  // prevent a marketplace write, never allow one.
  if (!await userHasFeature(user.id, 'stock_sync')) {
    return NextResponse.json({ ok: false, error: 'Plan required' }, { status: 403 })
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'orderId (uuid) required' }, { status: 400 })

  const userShops = await db.select({
    id: shops.id, marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted, shop_id_external: shops.shop_id_external,
  }).from(shops).where(eq(shops.user_id, user.id))
  const shopById = new Map(userShops.map(s => [s.id, s]))

  const [order] = shopById.size
    ? await db.select({ id: orders.id, shop_id: orders.shop_id, order_id_external: orders.order_id_external })
        .from(orders).where(and(eq(orders.id, parsed.data.orderId), inArray(orders.shop_id, [...shopById.keys()])))
    : []
  if (!order || !order.order_id_external) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 })
  }
  const shop = shopById.get(order.shop_id)!

  const result = await cancelOrder({
    shop: {
      id: shop.id, marketplace: shop.marketplace as MarketplaceType,
      api_key_encrypted: shop.api_key_encrypted, shop_id_external: shop.shop_id_external,
    },
    orderIdExternal: order.order_id_external,
    reason: 'OUT_OF_STOCK',
    dryRun: false,
    auto: false,
  })

  return NextResponse.json({ ok: result.status === 'sent', ...result })
})
