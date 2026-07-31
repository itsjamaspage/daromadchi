import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, unitEconomicsItems } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { withErrorHandler } from '@/lib/api-handler'

// Backfill: reapply the current extension-side math (v2.5.2) to rows
// that were inserted by earlier versions. Two changes to apply:
//
//   1. Yandex Market has no separate delivery line — the seller's
//      balance page shows one aggregate deduction ("Услуги Маркета")
//      that includes commission + order processing + placement +
//      last-mile + acquiring. Set delivery to 0 and roll the whole
//      bundle into the commission. Bundle target for FBS is 20%
//      (electronics tier, verified against real settlement: 76 000
//      UZS order → 16 060 UZS services = 21% total). Rewrite the
//      stored commission when the current value is clearly a "raw
//      only" number (≤10% of price for a YM row) so we don't clobber
//      a value the seller manually edited high.
//
//   2. Ad-spend default went from 5% to 0%. Rows where the stored
//      ad_spend matches selling_price × 5% within a 1-so'm rounding
//      tolerance were auto-defaulted (never touched by the seller);
//      those get zeroed. Rows where the seller typed a real % into
//      the widget won't match the 5% exactly and are left alone.
//
// Derived fields (net_profit, margin, roi) are recomputed from the
// stored inputs after the fix so the table shows a consistent view.
// The endpoint is idempotent — running it twice is a no-op.

export const POST = withErrorHandler(async () => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const rows = await db.select().from(unitEconomicsItems)
    .where(eq(unitEconomicsItems.user_id, userId))

  let ymBundleFixed = 0
  let adSpendFixed  = 0
  let updated       = 0

  for (const row of rows) {
    const sellingPrice = Number(row.selling_price)
    const costPrice    = Number(row.cost_price)
    const landedCost   = row.landed_cost !== null ? Number(row.landed_cost) : 0

    let   commission    = Number(row.commission)
    let   commissionPct = Number(row.commission_pct)
    let   delivery      = Number(row.delivery)
    const lastMile      = Number(row.last_mile)
    const acquiring     = Number(row.acquiring)
    let   adSpend       = Number(row.ad_spend)
    const tax           = Number(row.tax)

    let touched = false

    // Fix 1 — YM Услуги Маркета bundle. Zero out any delivery line
    // (YM has none) and promote a raw-commission-only value to the
    // 20% FBS bundle so the row totals match the seller's balance
    // page. A stored raw % on YM is anything ≤10% — the seller can
    // still manually edit past that with the row-level editor.
    if (row.marketplace === 'yandex_market') {
      let ymTouched = false
      if (delivery > 0) {
        delivery = 0
        ymTouched = true
      }
      if (sellingPrice > 0 && commissionPct > 0 && commissionPct <= 10) {
        commissionPct = 20
        commission    = Math.round(sellingPrice * 0.20)
        ymTouched     = true
      }
      if (ymTouched) {
        touched = true
        ymBundleFixed++
      }
    }

    // Fix 2 — 5%-of-price auto-default ad_spend rewrite. Compare using
    // the same Math.round the extension used so we recognise the exact
    // shape it produced.
    const autoAd = Math.round(sellingPrice * 5 / 100)
    if (adSpend > 0 && Math.abs(adSpend - autoAd) <= 1) {
      adSpend = 0
      touched = true
      adSpendFixed++
    }

    if (!touched) continue

    const cogs      = costPrice + landedCost
    const netProfit = sellingPrice - commission - delivery - lastMile - acquiring - adSpend - tax - cogs
    const margin    = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0
    const roi       = cogs > 0 ? (netProfit / cogs) * 100 : 0

    await db.update(unitEconomicsItems).set({
      commission_pct: String(commissionPct),
      commission:     String(commission),
      delivery:       String(delivery),
      ad_spend:       String(adSpend),
      net_profit:     String(Math.round(netProfit)),
      margin:         String(Math.round(margin * 10) / 10),
      roi:            cogs > 0 ? String(Math.round(roi * 10) / 10) : row.roi,
      updated_at:     new Date(),
    }).where(and(
      eq(unitEconomicsItems.id, row.id),
      eq(unitEconomicsItems.user_id, userId),
    ))
    updated++
  }

  return NextResponse.json({
    ok: true,
    scanned:        rows.length,
    updated,
    ymBundleFixed,
    adSpendFixed,
  })
})
