import { NextResponse } from 'next/server'
import { inArray, and, gte, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, uzumSettlementOrders, yandexSettlementTransactions, unitEconomicsItems } from '@/lib/db'
import { getRealFinancialsByBucket, getRealRatesBySku } from '@/lib/db/real-financials'
import { withErrorHandler } from '@/lib/api-handler'
import { isYandexTransferred } from '@/lib/db/payout-status'

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
      // First 25 (was 5) — five was fewer rows than a single month holds, so the
      // transferred ones were routinely among the omitted.
      rows: ymRows.slice(0, 25).map(r => ({
        transaction_id: r.transaction_id,
        // The three fields that decide whether an order reads as paid. They were
        // missing here, which made this endpoint unable to answer the one
        // question it gets opened for: "why is this order not marked Выплачено?"
        order_id_external: r.order_id_external,
        status_note: r.status_note,
        payment_order_number: r.payment_order_number,
        entry_type: r.entry_type,
        entry_source: r.entry_source,
        order_type: r.order_type,
        sku: r.sku,
        amount: r.amount,
        transaction_at: r.transaction_at,
      })),
      // The verdict, so nobody has to re-derive it by eye from the rows above.
      // Per order: is any of its own transactions proven transferred, and if the
      // month has a payment-order number that none of its orders carries, say so
      // — that is the exact shape that would leave a month showing «п/п 92735»
      // while every order in it reads «Ожидает».
      transferSignal: (() => {
        const byOrder = new Map<string, { net: number; transferred: boolean; paymentOrders: Set<string> }>()
        const monthPaymentOrders = new Set<string>()
        let rowsWithoutOrderNumber = 0
        for (const r of ymRows) {
          const transferred = isYandexTransferred(r.status_note, r.payment_order_number)
          if (transferred && r.payment_order_number) monthPaymentOrders.add(String(r.payment_order_number).trim())
          const num = r.order_id_external ? String(r.order_id_external).trim() : ''
          if (!num) { if (transferred) rowsWithoutOrderNumber++; continue }
          const b = byOrder.get(num) ?? { net: 0, transferred: false, paymentOrders: new Set<string>() }
          const amt = Number(r.amount ?? 0)
          b.net += r.entry_type === 'Начисление' ? amt : -Math.abs(amt)
          if (transferred) {
            b.transferred = true
            if (r.payment_order_number) b.paymentOrders.add(String(r.payment_order_number).trim())
          }
          byOrder.set(num, b)
        }
        return {
          orders: [...byOrder.entries()].map(([number, b]) => ({
            number, net: b.net, transferred: b.transferred, paymentOrders: [...b.paymentOrders],
          })),
          monthPaymentOrders: [...monthPaymentOrders],
          transferredRowsWithoutOrderNumber: rowsWithoutOrderNumber,
          paidTotal: [...byOrder.values()].reduce((t, b) => t + (b.transferred ? b.net : 0), 0),
        }
      })(),
    },
    aggregator: { buckets },
    perSkuRates: ratesBySku,
    unitEconomicsItems: ueVsRates,
  })
})
