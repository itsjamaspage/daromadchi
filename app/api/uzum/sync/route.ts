import { NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Avtorizatsiya talab etiladi' }, { status: 401 })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'uzum')
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json(
      { ok: false, error: 'Uzum API token topilmadi. Sozlamalar sahifasida tokenni kiriting.' },
      { status: 400 },
    )
  }

  const result = await syncFromUzum(shop.id, shop.api_key_encrypted)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

// GET /api/uzum/sync — lightweight token test (no data written)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'uzum')
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api-seller.uzum.uz/api/v1/products?page=0&size=1', {
      headers: { Authorization: `Bearer ${shop.api_key_encrypted}`, Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json(
        { ok: false, error: `Token noto'g'ri yoki muddati o'tgan (${res.status})`, detail: body.slice(0, 200) },
      )
    }
    return NextResponse.json({ ok: true, message: "Uzum token ishlayapti — sinxronizatsiyani boshlashingiz mumkin" })
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tarmoq xatosi: ${String(err)}` })
  }
}

