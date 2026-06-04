import { NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

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
    .eq('is_active', true)
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json(
      { ok: false, error: 'Uzum API token topilmadi. Sozlamalar sahifasida tokenni kiriting.' },
      { status: 400 },
    )
  }

  const token = decrypt(shop.api_key_encrypted)
  const result = await syncFromUzum(shop.id, token)
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
    .eq('is_active', true)
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }

  try {
    const token = decrypt(shop.api_key_encrypted)
    const url = 'https://api-seller.uzum.uz/api/seller-openapi/v1/shops'
    // Try multiple auth formats to find what Uzum accepts
    const attempts: { label: string; headers: Record<string, string> }[] = [
      { label: 'Bearer',    headers: { Authorization: `Bearer ${token.trim()}` } },
      { label: 'Token',     headers: { Authorization: `Token ${token.trim()}` } },
      { label: 'token hdr', headers: { token: token.trim() } },
      { label: 'X-Api-Key', headers: { 'X-Api-Key': token.trim() } },
    ]
    for (const attempt of attempts) {
      const res = await fetch(url, {
        headers: { ...attempt.headers, Accept: 'application/json' },
        next: { revalidate: 0 },
      })
      if (res.ok) {
        // Record which format worked so we can bake it in
        return NextResponse.json({ ok: true, message: `Uzum token ishlayapti (${attempt.label}) — sinxronizatsiyani boshlashingiz mumkin` })
      }
      if (res.status !== 403 && res.status !== 401) break // unexpected error
    }
    const body = await fetch(url, {
      headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' },
      next: { revalidate: 0 },
    }).then(r => r.text()).catch(() => '')
    return NextResponse.json(
      { ok: false, error: `Uzum token noto'g'ri yoki muddati o'tgan. seller.uzum.uz → Sozlamalar → API integratsiya sahifasidan tokenni qayta nusxalab saqlang.`, detail: body.slice(0, 300) },
    )
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tarmoq xatosi: ${String(err)}` })
  }
}
