import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, unitEconomicsItems } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { withErrorHandler } from '@/lib/api-handler'

// Backfill: reapply the current extension-side math (v2.5.1) to rows
// that were inserted by earlier versions. Two changes to apply:
//
//   1. Yandex Market delivery is not a volumetric per-unit fee. YM UZ
//      charges an "Услуги Маркета" services bundle (order processing +
//      placement + last-mile via YM Express + acquiring). For FBS the
//      bundle is ~15% of price on top of the raw category commission.
//      Verified against real settlement — 76 000 UZS order was billed
//      16 060 UZS in services (21.1% = 5% raw commission + 15% bundle
//      + ~1% acquiring). Rewrite the stored delivery to 15% of price
//      only when the current value looks like the old volumetric
//      estimate (0 or a multiple of 5 000) — never clobber a value
//      the seller manually edited to something arbitrary.
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

  let ymDeliveryFixed = 0
  let adSpendFixed    = 0
  let updated         = 0

  for (const row of rows) {
    const sellingPrice = Number(row.selling_price)
    const costPrice    = Number(row.cost_price)
    const landedCost   = row.landed_cost !== null ? Number(row.landed_cost) : 0

    const commission = Number(row.commission)
    let   delivery   = Number(row.delivery)
    const lastMile   = Number(row.last_mile)
    const acquiring  = Number(row.acquiring)
    let   adSpend    = Number(row.ad_spend)
    const tax        = Number(row.tax)

    let touched = false

    // Fix 1 — YM services bundle. Replace old volumetric estimate (or a
    // previous over-correction to 0) with 15% of price, which matches
    // what YM UZ actually bills for FBS orders on top of the raw
    // category commission.
    if (row.marketplace === 'yandex_market') {
      const target = Math.round(sellingPrice * 0.15)
      const looksVolumetric = delivery === 0 || (delivery > 0 && delivery % 5000 === 0)
      if (looksVolumetric && Math.abs(delivery - target) > 1) {
        delivery = target
        touched  = true
        ymDeliveryFixed++
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
      delivery:   String(delivery),
      ad_spend:   String(adSpend),
      net_profit: String(Math.round(netProfit)),
      margin:     String(Math.round(margin * 10) / 10),
      roi:        cogs > 0 ? String(Math.round(roi * 10) / 10) : row.roi,
      updated_at: new Date(),
    }).where(and(
      eq(unitEconomicsItems.id, row.id),
      eq(unitEconomicsItems.user_id, userId),
    ))
    updated++
  }

  return NextResponse.json({
    ok: true,
    scanned:          rows.length,
    updated,
    ymDeliveryFixed,
    adSpendFixed,
  })
})
