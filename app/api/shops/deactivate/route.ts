/**
 * Disconnect a shop — the other half of #303.
 *
 * #303 made an unfamiliar campaign id create a NEW shop instead of overwriting
 * (and wiping) the existing one. That is right for "adding my second campaign",
 * but the request that looks identical — "moving to a different account" — then
 * leaves the seller with two live shops and no way to remove the stale one: it
 * keeps syncing on its old token, keeps showing in dashboards, and keeps
 * inflating the turnover that drives their recommended tier.
 *
 * This is the explicit second step that makes a genuine account switch possible:
 * add the new campaign, then disconnect the old one.
 *
 * SOFT, never hard. It flips `is_active` and nothing else. The rows stay, so the
 * seller's history survives and the action is reversible — deliberately the
 * opposite of the `clearShopData()` behaviour #303 removed. It must NEVER delete
 * order or product data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

const Schema = z.object({
  shopId: z.string().uuid(),
  /** false re-connects a previously disconnected shop. */
  active: z.boolean().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }
  const { shopId } = parsed.data
  const nextActive = parsed.data.active ?? false

  // Ownership is enforced in the WHERE clause, not by a prior read: a check-then-
  // write would leave a window, and one predicate cannot be forgotten. A shop
  // belonging to someone else simply matches nothing and 404s.
  const [updated] = await db.update(shops)
    .set({ is_active: nextActive })
    .where(and(eq(shops.id, shopId), eq(shops.user_id, user.id)))
    .returning({ id: shops.id, name: shops.name, marketplace: shops.marketplace })

  if (!updated) {
    return NextResponse.json({ ok: false, error: 'Магазин не найден' }, { status: 404 })
  }

  logger.info(nextActive ? 'shop_reactivated' : 'shop_deactivated', {
    userId: user.id, shopId, marketplace: updated.marketplace,
  })

  // Which shops the dashboards aggregate over just changed, so every cached
  // product/order/settlement view is stale.
  revalidateTag('product-data', { expire: 0 })
  revalidateTag('order-data', { expire: 0 })
  revalidateTag('settlements', { expire: 0 })

  return NextResponse.json({ ok: true, shop: updated, active: nextActive })
})
