import { NextResponse } from 'next/server'
import { inArray, and, gte, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, uzumSettlementOrders, yandexSettlementTransactions, unitEconomicsItems } from '@/lib/db'
import { getRealFinancialsByBucket, getRealRatesBySku } from '@/lib/db/real-financials'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

// Diagnostic: dumps raw settlement rows for the current user + the exact
// output of getRealFinancialsByBucket. Purely for debugging the
// Dashboard KPI vs Payouts mismatch — safe to leave in place, it only
// reveals the caller's own data.
export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const userShops = await db.select({ id: shops.id, marketplace: shops.marketplace, shop_id_external: shops.shop_id_external })
    .from(shops).where(eq(shops.user_id, user.id))
  const shopIds = userShops.map(s => s.id)

  // Fixed 30-day window so results are stable across quick re-runs.
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const uzShopIds = userShops.filter(s => s.marketplace === 'uzum').map(s => s.id)
  const ymShopIds = userShops.filter(s => s.marketplace === 'yandex_market').map(s => s.id)

  const [uzRows, ymRows] = await Promise.all([
    uzShopIds.length > 0 ? db.select().from(uzumSettlementOrders).where(inArray(uzumSettlementOrders.shop_id, uzShopIds)) : Promise.resolve([]),
    ymShopIds.length > 0 ? db.select().from(yandexSettlementTransactions).where(inArray(yandexSettlementTransactions.shop_id, ymShopIds)) : Promise.resolve([]),
  ])

  const uzFilteredCount = uzRows.filter(r => r.transaction_at != null && r.transaction_at >= since).length
  const ymFilteredCount = ymRows.filter(r => r.transaction_at != null && r.transaction_at >= since).length

  const bucketMap = await getRealFinancialsByBucket(shopIds, since, 'month')
  const buckets = Array.from(bucketMap.entries()).map(([k, v]) => ({ bucket: k, ...v }))

  // SKU-level view — the piece that decides whether Unit Economics
  // rows pick up real per-SKU rates. When these don't match, the UE
  // table falls back to hardcoded defaults and the seller sees the
  // "11% / 5% / 17%" placeholder rows they complained about.
  const rateMap = await getRealRatesBySku(user.id)
  const ratesBySku = Array.from(rateMap.entries()).map(([sku, r]) => ({ sku, ...r }))
  const ueItems = await db.select({
    id: unitEconomicsItems.id,
    title: unitEconomicsItems.title,
    sku: unitEconomicsItems.sku,
    marketplace: unitEconomicsItems.marketplace,
  }).from(unitEconomicsItems).where(eq(unitEconomicsItems.user_id, user.id))
  // Cross-check: for each UE item, does its SKU match any real-rate SKU?
  const ueVsRates = ueItems.map(it => ({
    ...it,
    matchedRate: it.sku ? (rateMap.get(it.sku) ?? null) : null,
    // Also show what real-rate SKU (if any) CONTAINS the UE SKU — helps
    // spot cases where Uzum stored "5124786-JMJ16BEG" while UE stored
    // just "JMJ16BEG" (or vice versa).
    substringMatchOfRateSku: it.sku
      ? Array.from(rateMap.keys()).find(k => k === it.sku || k.includes(it.sku!) || (it.sku! && it.sku!.includes(k))) ?? null
      : null,
  }))

  return NextResponse.json({
    ok: true,
    windowSince: since.toISOString(),
    shops: userShops,
    uzum: {
      totalRows: uzRows.length,
      rowsInWindow: uzFilteredCount,
      rows: uzRows.map(r => ({
        uzum_order_item_id: r.uzum_order_item_id,
        uzum_order_id: r.uzum_order_id,
        sku_title: r.sku_title,
        product_title: r.product_title,
        status: r.status,
        transaction_at: r.transaction_at,
        date_issued_at: r.date_issued_at,
        seller_price: r.seller_price,
        commission: r.commission,
        logistic_delivery_fee: r.logistic_delivery_fee,
        withdrawn_profit: r.withdrawn_profit,
        seller_profit: r.seller_profit,
      })),
    },
    yandex: {
      totalRows: ymRows.length,
      rowsInWindow: ymFilteredCount,
      // First 5 only to keep the payload small.
      rows: ymRows.slice(0, 5).map(r => ({
        transaction_id: r.transaction_id,
        entry_type: r.entry_type,
        entry_source: r.entry_source,
        order_type: r.order_type,
        sku: r.sku,
        amount: r.amount,
        transaction_at: r.transaction_at,
      })),
    },
    aggregator: { buckets },
    perSkuRates: ratesBySku,
    unitEconomicsItems: ueVsRates,
  })
})
