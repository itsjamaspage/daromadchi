import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { validateMarketplaceToken } from '@/lib/validate-token'
import { clearShopData } from '@/lib/db/clear-shop-data'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

const TokenSchema = z.object({
  marketplace: z.enum(['wildberries', 'uzum', 'yandex_market']),
  token:       z.string().max(2000).optional(),
  campaignId:  z.string().max(200).optional(),
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
  const { marketplace, token, campaignId, shopName } = parsed.data

  if (token?.trim()) {
    const valid = await validateMarketplaceToken(marketplace, token.trim(), campaignId?.trim())
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: 'Недействительный токен. Проверьте и попробуйте снова.' },
        { status: 400 },
      )
    }
  }

  const [existing] = await db.select({ id: shops.id, shop_id_external: shops.shop_id_external }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, marketplace), eq(shops.is_active, true)))

  const update: Record<string, unknown> = {}
  if (token?.trim()) {
    update.api_key_encrypted = encrypt(token.trim())
    update.token_valid = true
    update.last_synced_at = null
  }
  if (campaignId?.trim()) update.shop_id_external = campaignId.trim()

  // Saving a token must NOT destroy synced data: users re-save the same
  // account's token routinely (rotation, re-copy), and wiping left the app
  // empty until the next successful sync. Data is cleared ONLY when the shop
  // provably changed: a different Yandex campaign id here, or — for
  // marketplaces where the account id is only learnable via the API — inside
  // the sync when the fetched shop id differs from the stored one.
  let cleared = false
  if (existing) {
    const campaignChanged = !!campaignId?.trim() && !!existing.shop_id_external
      && existing.shop_id_external !== campaignId.trim()
    if (campaignChanged) {
      await clearShopData(existing.id)
      cleared = true
      logger.info('shops_token_cleared', { userId: user.id, marketplace, shopId: existing.id, reason: 'campaign_changed' })
    }
    await db.update(shops).set(update).where(eq(shops.id, existing.id))
  } else {
    await db.insert(shops).values({
      user_id: user.id,
      name: shopName ?? `${marketplace} do'konim`,
      marketplace,
      is_active: true,
      token_valid: !!token?.trim(),
      ...update,
    })
  }

  if (cleared) {
    revalidateTag('product-data', { expire: 0 })
    revalidateTag('order-data', { expire: 0 })
  }
  return NextResponse.json({
    ok: true,
    cleared,
    message: cleared
      ? 'Токен сохранён. Старые данные очищены. Нажмите Синхронизировать.'
      : 'Токен сохранён. Нажмите Синхронизировать.',
  })
})
