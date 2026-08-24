import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { validateMarketplaceToken } from '@/lib/validate-token'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'
import { resolveShopIdentity } from '@/lib/db/shop-identity'

const TokenSchema = z.object({
  marketplace: z.enum(['uzum', 'yandex_market']),
  token:       z.string().max(2000).optional(),
  campaignId:  z.string().max(200).optional(),
  // Yandex only. Persisted to shops.business_id so the netting-report
  // sync can hit the businessId-scoped endpoints without having to
  // resolve it from campaignId on every run.
  businessId:  z.string().max(200).optional(),
  shopName:    z.string().max(200).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = TokenSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }
  const { marketplace, token, campaignId, businessId, shopName } = parsed.data

  if (businessId?.trim() && !/^\d+$/.test(businessId.trim())) {
    return NextResponse.json({ ok: false, error: 'Business ID должен состоять только из цифр.' }, { status: 400 })
  }

  if (token?.trim()) {
    const valid = await validateMarketplaceToken(marketplace, token.trim(), campaignId?.trim())
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: 'Недействительный токен. Проверьте и попробуйте снова.' },
        { status: 400 },
      )
    }
  }

  // Identity includes the campaign id — see lib/db/shop-identity.ts. Without it
  // a seller's second Yandex campaign (the normal FBS + FBY shape) overwrote the
  // first shop AND wiped its data.
  const candidates = await db.select({ id: shops.id, shop_id_external: shops.shop_id_external }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, marketplace), eq(shops.is_active, true)))
  const resolved = resolveShopIdentity(candidates, campaignId)

  if (resolved.action === 'ambiguous') {
    // Only reachable once a user holds several campaigns for one marketplace:
    // writing a token onto an arbitrary one would be worse than refusing.
    return NextResponse.json(
      { ok: false, error: 'У вас несколько магазинов на этом маркетплейсе — укажите Campaign ID, чтобы выбрать нужный.' },
      { status: 400 },
    )
  }

  const update: Record<string, unknown> = {}
  if (token?.trim()) {
    update.api_key_encrypted = encrypt(token.trim())
    update.token_valid = true
    update.last_synced_at = null
  }
  if (campaignId?.trim()) update.shop_id_external = campaignId.trim()
  if (businessId?.trim()) update.business_id = businessId.trim()

  // A connect NEVER deletes synced data any more.
  //
  // This used to clear the shop whenever the campaign id differed from the one
  // on file, on the theory that a different id meant a different account. But an
  // unfamiliar id is equally "I am adding my second campaign", and the request
  // carries nothing that tells the two apart — so that branch destroyed the
  // first campaign's orders and products for every FBS + FBY seller who tried to
  // connect both.
  //
  // resolveShopIdentity now routes an unfamiliar id to a NEW shop, so no write
  // here can re-point an existing shop at a different campaign, and the clear
  // has no case left to fire on. A genuine account switch leaves a stale shop
  // instead of an erased one; removing it needs a delete endpoint, which does
  // not exist yet (follow-up).
  //
  // Uzum is unaffected: it sends no campaign id, and its own account-switch
  // detection still lives in the sync (lib/uzum/sync.ts), where the fetched shop
  // id is compared against the stored one.
  if (resolved.action === 'update') {
    if (resolved.adopts) {
      logger.info('shops_campaign_adopted', { userId: user.id, marketplace, shopId: resolved.shopId })
    }
    await db.update(shops).set(update).where(eq(shops.id, resolved.shopId))
  } else {
    await db.insert(shops).values({
      user_id: user.id,
      name: shopName ?? `${marketplace} do'konim`,
      marketplace,
      is_active: true,
      token_valid: !!token?.trim(),
      ...update,
    })
    // A new shop changes which shop ids the dashboards aggregate over, so the
    // cached product/order views have to be rebuilt even though it holds no
    // rows yet.
    revalidateTag('product-data', { expire: 0 })
    revalidateTag('order-data', { expire: 0 })
    logger.info('shops_created', { userId: user.id, marketplace, shopCount: candidates.length + 1 })
  }

  // `cleared` is kept in the payload for response-shape compatibility and is now
  // always false — a connect no longer deletes anything.
  return NextResponse.json({
    ok: true,
    cleared: false,
    message: 'Токен сохранён. Нажмите Синхронизировать.',
  })
})
