import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = TokenSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }
  const { marketplace, token, campaignId, shopName } = parsed.data

  // Validate token against the marketplace API before saving
  if (token?.trim()) {
    const valid = await validateMarketplaceToken(marketplace, token.trim())
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: 'Недействительный токен. Проверьте и попробуйте снова.' },
        { status: 400 },
      )
    }
  }

  const { data: existing } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .eq('is_active', true)
    .maybeSingle()

  const update: Record<string, string | boolean | null> = {}
  if (token?.trim()) {
    update.api_key_encrypted = encrypt(token.trim())
    update.token_valid = true
    update.last_synced_at = null
  }
  if (campaignId?.trim()) update.shop_id_external = campaignId.trim()

  if (existing) {
    if (token?.trim()) {
      await clearShopData(existing.id)
      logger.info('shops_token_cleared', { userId: user.id, marketplace, shopId: existing.id })
    }
    const { error } = await supabase.from('shops').update(update).eq('id', existing.id)
    if (error) {
      logger.error('shops_token_update_failed', { userId: user.id, marketplace, code: error.code })
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase.from('shops').insert({
      user_id: user.id,
      name: shopName ?? `${marketplace} do'konim`,
      marketplace,
      is_active: true,
      token_valid: !!token?.trim(),
      ...update,
    })
    if (error) {
      logger.error('shops_token_insert_failed', { userId: user.id, marketplace, code: error.code })
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  }

  const cleared = !!(token?.trim() && existing)
  return NextResponse.json({
    ok: true,
    cleared,
    message: cleared
      ? 'Токен сохранён. Старые данные очищены. Нажмите Синхронизировать.'
      : 'Токен сохранён.',
  })
})
