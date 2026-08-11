import { eq, and, inArray, desc } from 'drizzle-orm'
import { db, unitEconomicsItems, userSettings } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { getRealRatesBySku } from '@/lib/db/real-financials'
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

/**
 * Derive the two cost-group totals and attach them to the item. Called
 * as the last step of every read path so `directTotal` and
 * `turnoverTotal` are always in sync with whatever other fields the
 * upstream calc already settled on.
 *
 *   direct   — money the seller invested upfront, before the sale:
 *              purchase price + landed logistics to warehouse. This is
 *              what ROI divides by (net profit / invested capital) and
 *              the number a capital-efficient product keeps small.
 *   turnover — every fee the marketplace subtracts from each sale:
 *              commission + delivery + lastMile + acquiring + adSpend
 *              + tax. Grows with revenue rather than with your outlay.
 *
 * Pure derivation from existing fields, never persisted.
 */
function withTotals(item: UnitEconomicsItem): UnitEconomicsItem {
  const directTotal   = item.costPrice + (item.landedCost ?? 0)
  const turnoverTotal = item.commission + item.delivery + item.lastMile + item.acquiring + item.adSpend + item.tax
  return { ...item, directTotal, turnoverTotal }
}

export async function getUnitEconomicsItems(): Promise<UnitEconomicsItem[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const [rowsRaw, realRates] = await Promise.all([
    db.select().from(unitEconomicsItems)
      .where(eq(unitEconomicsItems.user_id, userId))
      .orderBy(desc(unitEconomicsItems.created_at)),
    // Real per-SKU commission + delivery rates from the seller's own
    // settlement history. When present for the item's SKU, they REPLACE
    // the stored/default Unit Economics fees so the page shows what
    // the marketplace actually charged, not a hard-coded percentage.
    getRealRatesBySku(userId),
  ])
  const rows = rowsRaw

  // Try exact SKU first, then normalised (uppercase + strip
  // punctuation), then any settlement SKU that contains the UE SKU
  // as a substring (Uzum's "5124786-JMJ16BEG" style). Same laxness
  // as the diagnose endpoint reports.
  const normSku = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const findRate = (sku: string, marketplace: string) => {
    const direct = realRates.get(sku)
    if (direct && direct.marketplace === marketplace) return direct
    const norm = normSku(sku)
    const normHit = realRates.get(norm)
    if (normHit && normHit.marketplace === marketplace) return normHit
    for (const [k, v] of realRates) {
      if (v.marketplace !== marketplace) continue
      if (k === sku || k.includes(sku) || sku.includes(k)) return v
      if (normSku(k) === norm || normSku(k).includes(norm) || norm.includes(normSku(k))) return v
    }
    return null
  }
  // Extension v2.5.2 corrections applied on the read path so users see
  // fixed numbers immediately without clicking Recalculate. Rules match
  // the /api/unit-economics/recalc endpoint exactly:
  //   1) Yandex Market has no separate delivery line — the seller's
  //      balance page shows one aggregate deduction ("Услуги Маркета")
  //      that includes commission + order processing + placement +
  //      last-mile + acquiring. Set delivery to 0 and roll the whole
  //      bundle into the commission %. Bundle target for FBS is
  //      currently 20% (electronics tier, matching real settlement:
  //      76 000 UZS order → 16 060 UZS services = 21% total). Rewrite
  //      commission_pct + commission when the stored commission is
  //      clearly a "raw only" number (≤10% of price for a YM row), so
  //      we don't clobber a value the seller manually edited high.
  //   2) Ad spend that equals sellingPrice × 5% within 1 so'm is the old
  //      auto-default from the widget — treat it as unset (0). Explicit
  //      user ad-% entries won't match the rounded 5% exactly.
  function applyV252Fix(item: UnitEconomicsItem): UnitEconomicsItem {
    let delivery      = item.delivery
    let commission    = item.commission
    let commissionPct = item.commissionPct
    let adSpend       = item.adSpend
    let touched       = false
    if (item.marketplace === 'yandex_market') {
      if (delivery > 0) {
        delivery = 0
        touched  = true
      }
      // Raw commission ≤10% on YM means the row was stored before we
      // rolled the services bundle into the number. Promote it to a
      // 20%-of-price bundle so the row totals match the seller's
      // balance page.
      if (item.sellingPrice > 0 && commissionPct > 0 && commissionPct <= 10) {
        commissionPct = 20
        commission    = Math.round(item.sellingPrice * 0.20)
        touched       = true
      }
    }
    const autoAd = Math.round(item.sellingPrice * 5 / 100)
    if (adSpend > 0 && Math.abs(adSpend - autoAd) <= 1) {
      adSpend = 0
      touched = true
    }
    if (!touched) return item
    // `direct` is the invested-capital denominator ROI divides by —
    // identical to the `directTotal` withTotals() attaches below.
    const direct    = item.costPrice + (item.landedCost ?? 0)
    const netProfit = item.sellingPrice - commission - delivery - item.lastMile - item.acquiring - adSpend - item.tax - direct
    const margin    = item.sellingPrice > 0 ? (netProfit / item.sellingPrice) * 100 : 0
    const roi       = direct > 0 ? (netProfit / direct) * 100 : 0
    return { ...item, delivery, commission, commissionPct, adSpend, netProfit, margin, roi }
  }

  return rows.map(row => {
    const item = applyV252Fix(mapRow(row))
    const sku = (item.sku ?? '').trim()
    if (!sku) return withTotals(item)
    const rate = findRate(sku, item.marketplace)
    if (!rate) return withTotals(item)

    // Recompute commission + delivery + downstream fields from real
    // rates. Preserve the user's own costPrice, ad %, tax, packaging.
    const commission = Math.round(item.sellingPrice * rate.commissionPct / 100)
    const delivery   = Math.round(item.sellingPrice * rate.deliveryPct   / 100)
    // `direct` is the invested-capital denominator ROI divides by —
    // identical to the `directTotal` withTotals() attaches below.
    const direct    = item.costPrice + (item.landedCost ?? 0)
    const netProfit = item.sellingPrice - commission - delivery - item.acquiring - item.adSpend - item.tax - direct
    const margin    = item.sellingPrice > 0 ? (netProfit / item.sellingPrice) * 100 : 0
    const roi       = direct > 0 ? (netProfit / direct) * 100 : 0
    return withTotals({
      ...item,
      commissionPct: rate.commissionPct,
      commission,
      delivery,
      netProfit,
      margin,
      roi,
      // Marker consumed by UnitEconomicsTable to show a "R" (real) badge
      // in the commission column instead of "≈".
      ratesSource: 'real' as const,
      ratesSourceItemCount: rate.itemCount,
    })
  })
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
