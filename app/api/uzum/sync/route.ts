import { NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'uzum')
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json(
      { error: 'Uzum API token topilmadi. Sozlamalar sahifasida token kiriting.' },
      { status: 400 }
    )
  }

  const result = await syncFromUzum(shop.id, shop.api_key_encrypted)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
