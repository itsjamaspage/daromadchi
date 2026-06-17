import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { syncFromWildberries } from '@/lib/wildberries/sync'

function fromDaysToDate(fromDays: unknown): Date | undefined {
  if (typeof fromDays !== 'number') return undefined
  if (fromDays === 0) return new Date('2019-01-01')
  const d = new Date(); d.setDate(d.getDate() - fromDays); return d
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('id, api_key_encrypted, last_synced_at')
    .eq('user_id', user.id)
    .eq('marketplace', 'wildberries')
    .maybeSingle()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'No Wildberries API token saved' }, { status: 400 })
  }

  if (shop.last_synced_at) {
    const minsAgo = (Date.now() - new Date(shop.last_synced_at).getTime()) / 60000
    if (minsAgo < 5) {
      const waitMins = Math.ceil(5 - minsAgo)
      return NextResponse.json(
        { ok: false, error: `Sinxronizatsiya ${waitMins} daqiqadan keyin bajarilishi mumkin` },
        { status: 429 },
      )
    }
  }

  const body = await req.json().catch(() => ({}))
  const fromDate = fromDaysToDate(body?.fromDays)
  const result = await syncFromWildberries(supabase, shop.id, decrypt(shop.api_key_encrypted), fromDate)
  return NextResponse.json(result)
}

// GET /api/wildberries/sync — lightweight token test, no data written
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'wildberries')
    .maybeSingle()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Token topilmadi' }, { status: 400 })
  }

  const token = decrypt(shop.api_key_encrypted)

  // Test with seller-info (common-api) — no IP whitelist required for some accounts
  try {
    const res = await fetch('https://common-api.wildberries.ru/api/v1/seller-info', {
      headers: { 'Authorization': token }
    })
    if (res.ok) {
      const info = await res.json()
      return NextResponse.json({
        ok: true,
        message: `Ulandi! Sotuvchi: ${info.supplierName || info.name || 'Wildberries'}`,
      })
    }
    if (res.status === 403) {
      return NextResponse.json({
        ok: false,
        error: 'IP-whitelist xatosi (403). Token faqat muayyan IP-dan foydalanish uchun sozlangan. Wildberries kabinetida IP cheklovini olib tashlang yoki yangi token yarating.',
      })
    }
    return NextResponse.json({ ok: false, error: `WB API xatosi: HTTP ${res.status}` })
  } catch {
    return NextResponse.json({ ok: false, error: 'WB API bilan bog\'lanishda xato' })
  }
}
