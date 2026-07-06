import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncFromUzum } from '@/lib/uzum/sync'
import { syncFromYandex } from '@/lib/yandex/sync'
import { syncFromWildberries } from '@/lib/wildberries/sync'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime    = 'nodejs'
export const maxDuration = 300  // 5 min — enough for full sync of multiple shops

const CONCURRENCY = 5

async function syncShop(
  shop: { id: string; marketplace: string; api_key_encrypted: string; shop_id_external: string | null },
): Promise<Record<string, unknown>> {
  const start = Date.now()
  try {
    const token = decrypt(shop.api_key_encrypted)
    let r: { ok: boolean; [key: string]: unknown } | undefined
    if (shop.marketplace === 'uzum') {
      r = { ...await syncFromUzum(shop.id, token) }
    } else if (shop.marketplace === 'yandex_market' && shop.shop_id_external) {
      r = { ...await syncFromYandex(shop.id, token, shop.shop_id_external) }
    } else if (shop.marketplace === 'wildberries') {
      const supabase = createAdminClient()
      r = { ...await syncFromWildberries(supabase, shop.id, token) }
    }
    if (!r) return { shopId: shop.id, marketplace: shop.marketplace, ok: true, skipped: true }
    return { shopId: shop.id, marketplace: shop.marketplace, ms: Date.now() - start, ...r }
  } catch (err) {
    return { shopId: shop.id, marketplace: shop.marketplace, ms: Date.now() - start, ok: false, error: String(err) }
  }
}

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

  const allShops = shops ?? []
  const results: Record<string, unknown>[] = []

  for (let i = 0; i < allShops.length; i += CONCURRENCY) {
    const batch = allShops.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map(syncShop))
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        results.push({ ok: false, error: String(outcome.reason) })
      }
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results })
})
