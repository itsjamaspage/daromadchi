import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.marketplace) {
    return NextResponse.json({ error: 'marketplace talab etiladi' }, { status: 400 })
  }

  const { marketplace, apiKey, shopIdExternal, shopName } = body as {
    marketplace:     'uzum' | 'yandex_market' | 'wildberries'
    apiKey?:         string
    shopIdExternal?: string
    shopName?:       string
  }

  if (!['uzum', 'yandex_market', 'wildberries'].includes(marketplace)) {
    return NextResponse.json({ error: 'marketplace noto\'g\'ri' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .eq('is_active', true)
    .maybeSingle()

  if (apiKey && apiKey.trim().length > 2000) {
    return NextResponse.json({ error: 'apiKey juda uzun' }, { status: 400 })
  }
  if (shopIdExternal && shopIdExternal.trim().length > 200) {
    return NextResponse.json({ error: 'shopIdExternal juda uzun' }, { status: 400 })
  }
  if (shopName && shopName.trim().length > 200) {
    return NextResponse.json({ error: 'shopName juda uzun' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (apiKey?.trim())        update.api_key_encrypted = encrypt(apiKey.trim())
  if (shopIdExternal?.trim()) update.shop_id_external  = shopIdExternal.trim()

  if (existing) {
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, message: 'O\'zgartirish yo\'q' })
    }
    const { error } = await supabase.from('shops').update(update).eq('id', existing.id)
    if (error) {
      logger.error('settings_save_update_failed', { userId: user.id, marketplace, code: error.code })
      return NextResponse.json({ error: 'Saqlashda xato yuz berdi' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
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
}
