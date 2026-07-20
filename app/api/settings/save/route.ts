import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'

const SaveSchema = z.object({
  marketplace:    z.enum(['uzum', 'yandex_market', 'wildberries']),
  apiKey:         z.string().max(2000).optional(),
  shopIdExternal: z.string().max(200).optional(),
  shopName:       z.string().max(200).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }
  const { marketplace, apiKey, shopIdExternal, shopName } = parsed.data

  const [existing] = await db.select({ id: shops.id }).from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, marketplace), eq(shops.is_active, true)))

  const update: Record<string, unknown> = {}
  if (apiKey?.trim())         update.api_key_encrypted = encrypt(apiKey.trim())
  if (shopIdExternal?.trim()) update.shop_id_external  = shopIdExternal.trim()

  if (existing) {
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, message: 'O\'zgartirish yo\'q' })
    }

    // Saving a token must NOT destroy synced data (same rule as
    // /api/shops/token): users re-save the same account's token routinely and
    // a wipe left the app empty until the next fully-successful sync. A real
    // account switch is detected inside the sync (shop_id_external check).
    if (apiKey?.trim()) update.last_synced_at = null

    await db.update(shops).set(update).where(eq(shops.id, existing.id))
    if (apiKey?.trim()) {
      revalidateTag('product-data', { expire: 0 })
      revalidateTag('order-data', { expire: 0 })
    }
    return NextResponse.json({ ok: true, cleared: false })
  }

  await db.insert(shops).values({
    user_id:     user.id,
    name:        shopName ?? (marketplace === 'uzum' ? 'Uzum do\'konim' : marketplace === 'wildberries' ? 'Wildberries do\'konim' : 'Yandex Market do\'konim'),
    marketplace,
    is_active:   true,
    ...update,
  })
  return NextResponse.json({ ok: true, created: true })
})
