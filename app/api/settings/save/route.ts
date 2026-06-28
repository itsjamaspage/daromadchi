import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

const SaveSchema = z.object({
  marketplace:    z.enum(['uzum', 'yandex_market', 'wildberries']),
  apiKey:         z.string().max(2000).optional(),
  shopIdExternal: z.string().max(200).optional(),
  shopName:       z.string().max(200).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }
  const { marketplace, apiKey, shopIdExternal, shopName } = parsed.data

  const { data: existing } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .eq('is_active', true)
    .maybeSingle()

  const update: Record<string, unknown> = {}
  if (apiKey?.trim())        update.api_key_encrypted = encrypt(apiKey.trim())
  if (shopIdExternal?.trim()) update.shop_id_external  = shopIdExternal.trim()

  if (existing) {
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, message: 'O\'zgartirish yo\'q' })
    }

    // When API key changes, wipe all old shop data so stale data doesn't show
    if (apiKey?.trim()) {
      const admin = createAdminClient()
      const { data: orderIds } = await admin
        .from('orders')
        .select('id')
        .eq('shop_id', existing.id)
      if (orderIds && orderIds.length > 0) {
        await admin.from('order_items').delete().in('order_id', orderIds.map((o: { id: string }) => o.id))
      }
      await admin.from('orders').delete().eq('shop_id', existing.id)
      await admin.from('products').delete().eq('shop_id', existing.id)
      await admin.from('sync_days').delete().eq('shop_id', existing.id)
      update.last_synced_at = null
      logger.info('settings_save_cleared_shop_data', { userId: user.id, marketplace, shopId: existing.id })
    }

    const { error } = await supabase.from('shops').update(update).eq('id', existing.id)
    if (error) {
      logger.error('settings_save_update_failed', { userId: user.id, marketplace, code: error.code })
      return NextResponse.json({ error: 'Saqlashda xato yuz berdi' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, cleared: !!(apiKey?.trim()) })
  }

  // Insert new shop
  const { error } = await supabase.from('shops').insert({
    user_id:     user.id,
    name:        shopName ?? (marketplace === 'uzum' ? 'Uzum do\'konim' : marketplace === 'wildberries' ? 'Wildberries do\'konim' : 'Yandex Market do\'konim'),
    marketplace,
    is_active:   true,
    ...update,
  })
  if (error) {
    logger.error('settings_save_insert_failed', { userId: user.id, marketplace, code: error.code })
    return NextResponse.json({ error: 'Saqlashda xato yuz berdi' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, created: true })
})
