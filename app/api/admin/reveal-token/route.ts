import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const marketplace = req.nextUrl.searchParams.get('marketplace') ?? 'yandex_market'

  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id, marketplace, api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .eq('is_active', true)
    .maybeSingle()

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  if (!shop.api_key_encrypted) return NextResponse.json({ error: 'No token stored' }, { status: 404 })

  try {
    const token = decrypt(shop.api_key_encrypted)
    return NextResponse.json({ marketplace: shop.marketplace, token })
  } catch {
    return NextResponse.json({ error: 'Decryption failed — ENCRYPTION_KEY may have changed' }, { status: 500 })
  }
}
