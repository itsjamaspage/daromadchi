import { NextRequest, NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api-handler'

function fromDaysToDate(fromDays: unknown): Date | undefined {
  if (typeof fromDays !== 'number') return undefined
  if (fromDays === 0) return new Date('2022-10-01') // Uzum launched Oct 2022
  const d = new Date(); d.setDate(d.getDate() - fromDays); return d
}

export const POST = withErrorHandler(async (req: NextRequest) => {
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

  const body = await req.json().catch(() => ({}))
  const fromDate = fromDaysToDate(body?.fromDays)

  try {
    const token = decrypt(shop.api_key_encrypted)
    const result = await syncFromUzum(shop.id, token, fromDate)
    if (!result.ok) logger.warn('uzum_sync_error', { shopId: shop.id, error: result.error })
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    logger.error('uzum_sync_unhandled', { shopId: shop.id, error: String(err) })
    return NextResponse.json({ ok: false, error: 'Sync xatosi yuz berdi' }, { status: 500 })
  }
})

// GET /api/uzum/sync — lightweight token test (no data written)
export const GET = withErrorHandler(async () => {
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
})
