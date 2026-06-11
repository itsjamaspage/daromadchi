import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/api/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.my_price !== undefined)              updates.my_price = body.my_price ? Number(body.my_price) : null
  if (body.last_competitor_price !== undefined) updates.last_competitor_price = body.last_competitor_price ? Number(body.last_competitor_price) : null
  if (body.label !== undefined)                 updates.label = body.label.trim()
  if (Object.keys(updates).length > 0)          updates.last_checked_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('competitor_watchlist')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('competitor_watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
