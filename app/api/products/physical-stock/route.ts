import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

// PATCH /api/products/physical-stock
// { sku: string, physical_stock: number | null }
// Updates physical_stock for ALL products with this SKU owned by the user.
export const PATCH = withErrorHandler(async (req: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sku: string = body.sku
  const physical_stock: number | null = body.physical_stock ?? null

  if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
  if (physical_stock !== null && (physical_stock < 0 || !Number.isInteger(physical_stock))) {
    return NextResponse.json({ error: 'physical_stock must be a non-negative integer' }, { status: 400 })
  }

  const { data: shops } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
  const shopIds = (shops ?? []).map(s => s.id)
  if (shopIds.length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('products')
    .update({ physical_stock })
    .in('shop_id', shopIds)
    .eq('sku', sku)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
