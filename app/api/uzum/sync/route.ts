import { NextResponse } from 'next/server'
import { syncFromUzum } from '@/lib/uzum/sync'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  // Read token from the user's profile in Supabase
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('uzum_api_token')
    .eq('id', user.id)
    .single()

  const token = (profile as any)?.uzum_api_token as string | null

  if (!token) {
    return NextResponse.json(
      { error: 'Uzum API token topilmadi. Sozlamalar sahifasida token kiriting.' },
      { status: 400 }
    )
  }

  const result = await syncFromUzum(token)

  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
