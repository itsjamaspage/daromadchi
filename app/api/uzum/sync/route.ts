import { NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'
import { decryptKey } from '@/lib/crypto'
import { getUserPlan, PLAN_SHOP_LIMITS } from '@/lib/api/auth'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plan  = await getUserPlan(user.id)
  const limit = PLAN_SHOP_LIMITS[plan]

  const { data: shops } = await supabase
    .from('shops')
    .select('id, api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'uzum')
    .order('created_at', { ascending: true })

  if (!shops || shops.length === 0) {
    return NextResponse.json(
      { error: 'Uzum API token topilmadi. Sozlamalar sahifasida token kiriting.' },
      { status: 400 }
    )
  }

  const allowed   = shops.slice(0, limit).filter(s => s.api_key_encrypted)
  const overLimit = shops.length > limit

  const results = await Promise.all(
    allowed.map(shop => syncFromUzum(shop.id, decryptKey(shop.api_key_encrypted)))
  )

  const allOk = results.every(r => r.ok)
  return NextResponse.json(
    {
      ok: allOk,
      synced: results.length,
      results,
      ...(overLimit ? { warning: 'SHOP_LIMIT_REACHED' } : {}),
    },
    { status: allOk ? 200 : 500 }
  )
}
