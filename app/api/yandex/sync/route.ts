import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncFromYandex } from '@/lib/yandex/sync'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autentifikatsiya talab etiladi' }, { status: 401 })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, api_key_encrypted, shop_id_external')
    .eq('user_id', user.id)
    .eq('marketplace', 'yandex_market')
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Yandex API token topilmadi. Avval sozlamalarda tokenni saqlang.' }, { status: 400 })
  }

  if (!shop?.shop_id_external) {
    return NextResponse.json({ ok: false, error: 'Yandex Campaign ID topilmadi. Avval sozlamalarda Campaign ID saqlang.' }, { status: 400 })
  }

  const result = await syncFromYandex(shop.id, shop.api_key_encrypted, shop.shop_id_external)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
