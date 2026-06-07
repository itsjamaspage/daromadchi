import { createClient } from '@/lib/supabase/server'
import type { UnitEconomicsItem, UnitEcoSettings } from '@/lib/types'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

function mapRow(row: Record<string, unknown>): UnitEconomicsItem {
  return {
    id:            row.id as string,
    title:         row.title as string,
    image:         (row.image as string) ?? undefined,
    sku:           (row.sku as string) ?? undefined,
    category:      (row.category as string) ?? undefined,
    marketplace:   row.marketplace as MarketplaceType,
    sellingPrice:  Number(row.selling_price),
    costPrice:     Number(row.cost_price),
    commissionPct: Number(row.commission_pct),
    commission:    Number(row.commission),
    delivery:      Number(row.delivery),
    lastMile:      Number(row.last_mile),
    acquiring:     Number(row.acquiring),
    adSpend:       Number(row.ad_spend),
    tax:           Number(row.tax),
    netProfit:     Number(row.net_profit),
    roi:           row.roi !== null ? Number(row.roi) : 0,
    margin:        Number(row.margin),
    stock:         row.stock !== null ? Number(row.stock) : undefined,
    weight:        row.weight !== null ? Number(row.weight) : undefined,
    supplierUrl:   (row.supplier_url as string) ?? undefined,
    productUrl:    (row.product_url as string) ?? undefined,
    addedAt:       row.created_at as string,
  }
}

export async function getUnitEconomicsItems(): Promise<UnitEconomicsItem[]> {
  if (!supabaseConfigured) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('unit_economics_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapRow)
}

export async function deleteUnitEconomicsItems(ids: string[]): Promise<void> {
  if (!supabaseConfigured || ids.length === 0) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('unit_economics_items').delete().in('id', ids).eq('user_id', user.id)
}

export async function updateUnitEconomicsSupplier(id: string, supplierUrl: string): Promise<void> {
  if (!supabaseConfigured) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('unit_economics_items')
    .update({ supplier_url: supplierUrl, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
}

export async function addUnitEconomicsItem(
  item: Omit<UnitEconomicsItem, 'id' | 'addedAt'>
): Promise<{ id: string } | null | false> {
  if (!supabaseConfigured) return { id: `mock-${Date.now()}` }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null   // null = not authenticated → 401

  const { data, error } = await supabase
    .from('unit_economics_items')
    .insert({
      user_id:        user.id,
      title:          item.title,
      image:          item.image ?? null,
      sku:            item.sku ?? null,
      category:       item.category ?? null,
      marketplace:    item.marketplace,
      selling_price:  item.sellingPrice,
      cost_price:     item.costPrice,
      commission_pct: item.commissionPct,
      commission:     item.commission,
      delivery:       item.delivery,
      last_mile:      item.lastMile,
      acquiring:      item.acquiring,
      ad_spend:       item.adSpend,
      tax:            item.tax,
      net_profit:     item.netProfit,
      roi:            item.roi ?? null,
      margin:         item.margin,
      stock:          item.stock ?? null,
      weight:         item.weight ?? null,
      supplier_url:   item.supplierUrl ?? null,
      product_url:    item.productUrl ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return false  // false = DB error → 500
  return { id: data.id as string }
}

export async function getUnitEcoSettings(): Promise<UnitEcoSettings> {
  const defaults: UnitEcoSettings = {
    acquiringPct: 1.5, lastMilePct: 0, adPct: 5,
    taxPct: 6, taxType: 'income', defaultCommissionPct: 10,
  }
  if (!supabaseConfigured) return defaults

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return defaults

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!data) return defaults
  return {
    acquiringPct:        Number(data.ue_acquiring_pct),
    lastMilePct:         Number(data.ue_last_mile_pct),
    adPct:               Number(data.ue_ad_pct),
    taxPct:              Number(data.ue_tax_pct),
    taxType:             data.ue_tax_type as UnitEcoSettings['taxType'],
    defaultCommissionPct: Number(data.ue_comm_pct),
  }
}

export async function saveUnitEcoSettings(s: UnitEcoSettings): Promise<void> {
  if (!supabaseConfigured) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('user_settings').upsert({
    user_id:          user.id,
    ue_acquiring_pct: s.acquiringPct,
    ue_last_mile_pct: s.lastMilePct,
    ue_ad_pct:        s.adPct,
    ue_tax_pct:       s.taxPct,
    ue_tax_type:      s.taxType,
    ue_comm_pct:      s.defaultCommissionPct,
    updated_at:       new Date().toISOString(),
  })
}
