import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { marketplace, token, campaignId, shopName } = body

  if (!marketplace) return NextResponse.json({ ok: false, error: 'marketplace required' }, { status: 400 })

  const update: Record<string, string | boolean> = {}
  if (token?.trim())      update.api_key_encrypted = encrypt(token.trim())
  if (campaignId?.trim()) update.shop_id_external  = campaignId.trim()

  const { data: existing } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('shops').update(update).eq('id', existing.id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('shops').insert({
      user_id: user.id,
      name: shopName ?? `${marketplace} do'konim`,
      marketplace,
      is_active: true,
      ...update,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
