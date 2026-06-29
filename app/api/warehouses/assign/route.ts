import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

// POST { shopId, warehouseId } — assign a shop to a warehouse (or null to unassign)
export const POST = withErrorHandler(async (req: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopId, warehouseId } = await req.json()
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

  const { error } = await supabase
    .from('shops')
    .update({ warehouse_id: warehouseId ?? null })
    .eq('id', shopId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
