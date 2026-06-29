import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

// GET — return all warehouses + all shops (with warehouse assignments) for current user
export const GET = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: warehouses }, { data: shops }] = await Promise.all([
    supabase
      .from('warehouses')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('shops')
      .select('id, name, marketplace, warehouse_id')
      .eq('user_id', user.id)
      .neq('shop_id_external', 'DEMO'),
  ])

  return NextResponse.json({ warehouses: warehouses ?? [], shops: shops ?? [] })
})

// POST — create new warehouse { name }
export const POST = withErrorHandler(async (req: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('warehouses')
    .insert({ user_id: user.id, name: name.trim() })
    .select('id, name, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ warehouse: data })
})

// DELETE /?id=xxx — delete warehouse by id
export const DELETE = withErrorHandler(async (req: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
