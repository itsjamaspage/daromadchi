import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchYandexCategories, fetchCategoryModels } from '@/lib/yandex/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action     = searchParams.get('action') ?? 'categories'
  const categoryId = searchParams.get('categoryId')

  // Need the user's Yandex token for API calls
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Autentifikatsiya talab etiladi' }, { status: 401 })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .eq('marketplace', 'yandex_market')
    .single()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json(
      { error: 'Yandex API token topilmadi. Sozlamalarda Yandex tokeningizni saqlang.' },
      { status: 400 }
    )
  }

  const token = shop.api_key_encrypted

  try {
    if (action === 'categories') {
      const categories = await fetchYandexCategories(token)
      return NextResponse.json({ categories }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600' },
      })
    }

    if (action === 'models' && categoryId) {
      const id     = parseInt(categoryId, 10)
      const sort   = (searchParams.get('sort') ?? 'OPINIONS') as 'OPINIONS' | 'PRICE' | 'QUALITY'
      const models = await fetchCategoryModels(token, id, 30, sort)
      return NextResponse.json({ models }, {
        headers: { 'Cache-Control': 'public, s-maxage=300' },
      })
    }

    return NextResponse.json({ error: 'action veya categoryId talab etiladi' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
