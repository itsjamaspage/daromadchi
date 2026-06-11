import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/api/auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('competitor_watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label, competitor_url, my_product_title, my_price, last_competitor_price } = body

  if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('competitor_watchlist')
    .insert({
      user_id: user.id,
      label: label.trim(),
      competitor_url: competitor_url?.trim() || null,
      my_product_title: my_product_title?.trim() || null,
      my_price: my_price ? Number(my_price) : null,
      last_competitor_price: last_competitor_price ? Number(last_competitor_price) : null,
      last_checked_at: (my_price || last_competitor_price) ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
