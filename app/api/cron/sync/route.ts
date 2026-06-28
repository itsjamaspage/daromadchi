import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncFromUzum } from '@/lib/uzum/sync'
import { syncFromYandex } from '@/lib/yandex/sync'
import { syncFromWildberries } from '@/lib/wildberries/sync'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime    = 'nodejs'
export const maxDuration = 300  // 5 min — enough for full sync of multiple shops

export const GET = withErrorHandler(async (req: Request) => {
  const url    = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, marketplace, api_key_encrypted, shop_id_external')
    .eq('is_active', true)
    .not('api_key_encrypted', 'is', null)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const results: Record<string, unknown>[] = []

  for (const shop of (shops ?? [])) {
    try {
      const token = decrypt(shop.api_key_encrypted)
      if (shop.marketplace === 'uzum') {
        const r = await syncFromUzum(shop.id, token)
        results.push({ shopId: shop.id, marketplace: 'uzum', ...r })
      } else if (shop.marketplace === 'yandex_market' && shop.shop_id_external) {
        const r = await syncFromYandex(shop.id, token, shop.shop_id_external)
        results.push({ shopId: shop.id, marketplace: 'yandex_market', ...r })
      } else if (shop.marketplace === 'wildberries') {
        const r = await syncFromWildberries(supabase, shop.id, token)
        results.push({ shopId: shop.id, marketplace: 'wildberries', ...r })
      }
    } catch (err) {
      results.push({ shopId: shop.id, ok: false, error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results })
})
