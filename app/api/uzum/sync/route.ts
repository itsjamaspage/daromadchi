import { NextRequest, NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

function fromDaysToDate(fromDays: unknown): Date | undefined {
  if (typeof fromDays !== 'number') return undefined
  if (fromDays === 0) return new Date('2019-01-01')
  const d = new Date(); d.setDate(d.getDate() - fromDays); return d
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Avtorizatsiya talab etiladi' }, { status: 401 })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, api_key_encrypted, last_synced_at')
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

  const body = await req.json().catch(() => ({}))
  const fromDate = fromDaysToDate(body?.fromDays)

  if (shop.last_synced_at && !fromDate) {
    const minsAgo = (Date.now() - new Date(shop.last_synced_at).getTime()) / 60000
    if (minsAgo < 5) {
      const waitMins = Math.ceil(5 - minsAgo)
      return NextResponse.json(
        { ok: false, error: `Sinxronizatsiya ${waitMins} daqiqadan keyin bajarilishi mumkin` },
        { status: 429 },
      )
    }
  }

  const token = decrypt(shop.api_key_encrypted)
  const result = await syncFromUzum(shop.id, token, fromDate)
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
    const res = await fetch('https://api-seller.uzum.uz/api/seller-openapi/v1/shops', {
      headers: { Authorization: token, Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      return NextResponse.json({ ok: true, message: `Uzum token ishlayapti — sinxronizatsiyani boshlashingiz mumkin` })
    }
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    return NextResponse.json(
      { ok: false, error: `Uzum token noto'g'ri (${res.status}). seller.uzum.uz → Sozlamalar → API integratsiya sahifasidan API kalitini qayta nusxalab saqlang.`, detail: body.slice(0, 300) },
    )
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tarmoq xatosi: ${String(err)}` })
  }
}
