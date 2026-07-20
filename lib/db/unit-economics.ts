import { eq, and, inArray, desc } from 'drizzle-orm'
import { db, unitEconomicsItems, userSettings } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { UnitEconomicsItem, UnitEcoSettings, MarketplaceType } from '@/lib/types'

function mapRow(row: typeof unitEconomicsItems.$inferSelect): UnitEconomicsItem {
  return {
    id:            row.id,
    title:         row.title,
    image:         row.image ?? undefined,
    sku:           row.sku ?? undefined,
    category:      row.category ?? undefined,
    marketplace:   row.marketplace as MarketplaceType,
    sellingPrice:  Number(row.selling_price),
    costPrice:     Number(row.cost_price),
    landedCost:    row.landed_cost !== null ? Number(row.landed_cost) : 0,
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
    supplierUrl:   row.supplier_url ?? undefined,
    productUrl:    row.product_url ?? undefined,
    addedAt:       row.created_at.toISOString(),
  }
}

export async function getUnitEconomicsItems(): Promise<UnitEconomicsItem[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const rows = await db.select().from(unitEconomicsItems)
    .where(eq(unitEconomicsItems.user_id, userId))
    .orderBy(desc(unitEconomicsItems.created_at))

  return rows.map(mapRow)
}

export async function deleteUnitEconomicsItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const userId = await getCurrentUserId()
  if (!userId) return

  await db.delete(unitEconomicsItems)
    .where(and(inArray(unitEconomicsItems.id, ids), eq(unitEconomicsItems.user_id, userId)))
}

export async function updateUnitEconomicsSupplier(id: string, supplierUrl: string): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) return

  await db.update(unitEconomicsItems)
    .set({ supplier_url: supplierUrl, updated_at: new Date() })
    .where(and(eq(unitEconomicsItems.id, id), eq(unitEconomicsItems.user_id, userId)))
}

export async function updateUnitEconomicsItem(
  id: string,
  fields: Partial<Omit<UnitEconomicsItem, 'id' | 'addedAt'>>,
): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false

  const update: Record<string, unknown> = { updated_at: new Date() }
  if (fields.title         !== undefined) update.title          = fields.title
  if (fields.costPrice     !== undefined) update.cost_price     = String(fields.costPrice)
  if (fields.landedCost    !== undefined) update.landed_cost    = String(fields.landedCost)
  if (fields.sellingPrice  !== undefined) update.selling_price  = String(fields.sellingPrice)
  if (fields.commissionPct !== undefined) update.commission_pct = String(fields.commissionPct)
  if (fields.commission    !== undefined) update.commission     = String(fields.commission)
  if (fields.delivery      !== undefined) update.delivery       = String(fields.delivery)
  if (fields.lastMile      !== undefined) update.last_mile      = String(fields.lastMile)
  if (fields.acquiring     !== undefined) update.acquiring      = String(fields.acquiring)
  if (fields.adSpend       !== undefined) update.ad_spend       = String(fields.adSpend)
  if (fields.tax           !== undefined) update.tax            = String(fields.tax)
  if (fields.netProfit     !== undefined) update.net_profit     = String(fields.netProfit)
  if (fields.roi           !== undefined) update.roi            = String(fields.roi)
  if (fields.margin        !== undefined) update.margin         = String(fields.margin)
  if (fields.stock         !== undefined) update.stock          = fields.stock
  if (fields.supplierUrl   !== undefined) update.supplier_url   = fields.supplierUrl

  await db.update(unitEconomicsItems)
    .set(update)
    .where(and(eq(unitEconomicsItems.id, id), eq(unitEconomicsItems.user_id, userId)))

  return true
}

export async function addUnitEconomicsItem(
  item: Omit<UnitEconomicsItem, 'id' | 'addedAt'>
): Promise<{ id: string } | null | false> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const [row] = await db.insert(unitEconomicsItems).values({
    user_id:        userId,
    title:          item.title,
    image:          item.image ?? null,
    sku:            item.sku ?? null,
    category:       item.category ?? null,
    marketplace:    item.marketplace,
    selling_price:  String(item.sellingPrice),
    cost_price:     String(item.costPrice),
    landed_cost:    item.landedCost != null ? String(item.landedCost) : null,
    commission_pct: String(item.commissionPct),
    commission:     String(item.commission),
    delivery:       String(item.delivery),
    last_mile:      String(item.lastMile),
    acquiring:      String(item.acquiring),
    ad_spend:       String(item.adSpend),
    tax:            String(item.tax),
    net_profit:     String(item.netProfit),
    roi:            item.roi != null ? String(item.roi) : null,
    margin:         String(item.margin),
    stock:          item.stock ?? null,
    weight:         item.weight != null ? String(item.weight) : null,
    supplier_url:   item.supplierUrl ?? null,
    product_url:    item.productUrl ?? null,
  }).returning({ id: unitEconomicsItems.id })

  if (!row) return false
  return { id: row.id }
}

export async function getUnitEcoSettings(): Promise<UnitEcoSettings> {
  const defaults: UnitEcoSettings = {
    acquiringPct: 1.5, lastMilePct: 0, adPct: 5,
    taxPct: 6, taxType: 'income', defaultCommissionPct: 10,
  }

  const userId = await getCurrentUserId()
  if (!userId) return defaults

  const [row] = await db.select().from(userSettings)
    .where(eq(userSettings.user_id, userId))

  if (!row) return defaults
  return {
    acquiringPct:        Number(row.ue_acquiring_pct),
    lastMilePct:         Number(row.ue_last_mile_pct),
    adPct:               Number(row.ue_ad_pct),
    taxPct:              Number(row.ue_tax_pct),
    taxType:             row.ue_tax_type as UnitEcoSettings['taxType'],
    defaultCommissionPct: Number(row.ue_comm_pct),
  }
}

export async function saveUnitEcoSettings(s: UnitEcoSettings): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) return

  await db.insert(userSettings).values({
    user_id:          userId,
    ue_acquiring_pct: String(s.acquiringPct),
    ue_last_mile_pct: String(s.lastMilePct),
    ue_ad_pct:        String(s.adPct),
    ue_tax_pct:       String(s.taxPct),
    ue_tax_type:      s.taxType,
    ue_comm_pct:      String(s.defaultCommissionPct),
    updated_at:       new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      ue_acquiring_pct: String(s.acquiringPct),
      ue_last_mile_pct: String(s.lastMilePct),
      ue_ad_pct:        String(s.adPct),
      ue_tax_pct:       String(s.taxPct),
      ue_tax_type:      s.taxType,
      ue_comm_pct:      String(s.defaultCommissionPct),
      updated_at:       new Date(),
    },
  })
}
