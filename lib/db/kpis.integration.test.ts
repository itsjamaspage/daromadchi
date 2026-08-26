/**
 * The dashboard's Чистая прибыль must describe the SELECTED PERIOD's sales, and
 * nothing else — not payout runs that happened to land in it, and not the tail
 * of later weeks.
 *
 * Two bugs, one after the other, both visible on the seller's own dashboard:
 *
 *   1. The settlement total had no right-hand bound, so the KPI was "every
 *      settlement since this Monday, to forever" minus "this week's COGS".
 *      Fixed in #355.
 *   2. What was left ran on two clocks. Revenue and COGS are bucketed by
 *      orders.ordered_at; settlements were bucketed by transaction_at — when
 *      the marketplace PAID. A week with no sales showed +73 000 of profit, and
 *      a week with 200 000 of sales showed −52 250. That is this file.
 *
 * The fix puts every figure on the sale's clock, which makes two rules true by
 * construction. They are the acceptance criteria, asserted here directly:
 *
 *   • profit ≤ revenue, always. Profit is revenue minus costs and no cost is
 *     negative, so a profit above the period's own sales is arithmetically
 *     impossible — it can only mean money from outside the period leaked in.
 *   • no timing-driven negatives. A period with no sales is 0, not a loss.
 *
 * There is no pure function to stand in for any of this: the attribution is a
 * join. So it runs against a real Postgres.
 *
 * Run: DATABASE_URL=postgres://… node --conditions=react-server --import tsx \
 *        --test lib/db/kpis.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import {
  db, pool, users, shops, orders, orderItems, products,
  uzumSettlementOrders, yandexSettlementTransactions,
} from '@/lib/db'
import { fetchPeriodKpis } from '@/lib/db/kpis-period'
import { getRealFinancialsByBucket } from '@/lib/db/real-financials'

// The seller's three reported weeks, rebuilt from what their dashboard showed.
const W1 = { since: new Date('2026-08-05T00:00:00Z'), until: new Date('2026-08-11T23:59:59Z') }
const W2 = { since: new Date('2026-08-12T00:00:00Z'), until: new Date('2026-08-18T23:59:59Z') }
const W3 = { since: new Date('2026-08-19T00:00:00Z'), until: new Date('2026-08-25T23:59:59Z') }

let userId: string
let uzShop: string
let ymShop: string
let productId: string

before(async () => {
  userId = randomUUID(); uzShop = randomUUID(); ymShop = randomUUID(); productId = randomUUID()
  await db.insert(users).values({ id: userId, email: `kpi-${userId.slice(0, 8)}@test.local` })
  await db.insert(shops).values([
    { id: uzShop, user_id: userId, name: 'uz', marketplace: 'uzum' },
    { id: ymShop, user_id: userId, name: 'ym', marketplace: 'yandex_market' },
  ])
  // 65 000 a unit — the seller's real M9 cost price.
  await db.insert(products).values({
    id: productId, shop_id: uzShop, title: 'M9', sku: 'JMWHT',
    cost_price: '65000', stock_quantity: 0,
  })

  // ── W1: two sales, 200 000. Their settlements land in W3, three weeks later.
  const w1a = randomUUID(), w1b = randomUUID()
  await db.insert(orders).values([
    { id: w1a, shop_id: uzShop, order_id_external: '900001', marketplace: 'uzum',
      status: 'delivered', revenue: '100000', ordered_at: new Date('2026-08-06T10:00:00Z'), items_count: 1 },
    { id: w1b, shop_id: uzShop, order_id_external: '900002', marketplace: 'uzum',
      status: 'delivered', revenue: '100000', ordered_at: new Date('2026-08-07T10:00:00Z'), items_count: 1 },
  ])
  await db.insert(orderItems).values([
    { order_id: w1a, product_id: productId, quantity: 1, price_per_unit: '100000' },
    { order_id: w1b, product_id: productId, quantity: 1, price_per_unit: '100000' },
  ])
  await db.insert(uzumSettlementOrders).values([
    { shop_id: uzShop, uzum_order_item_id: 1, uzum_order_id: 900001, status: 'TO_WITHDRAW',
      transaction_at: new Date('2026-08-24T12:00:00Z'),   // ← paid in W3, sold in W1
      seller_price: '100000', commission: '12000', logistic_delivery_fee: '3000', seller_profit: '85000' },
    { shop_id: uzShop, uzum_order_item_id: 2, uzum_order_id: 900002, status: 'TO_WITHDRAW',
      transaction_at: new Date('2026-08-24T12:00:00Z'),
      seller_price: '100000', commission: '12000', logistic_delivery_fee: '3000', seller_profit: '85000' },
  ])

  // ── W2: nothing sold. A Yandex payout for an OLDER order lands mid-week —
  //    the money that used to show up as +73 000 of profit out of nowhere.
  const oldOrder = randomUUID()
  await db.insert(orders).values({
    id: oldOrder, shop_id: ymShop, order_id_external: '800001', marketplace: 'yandex_market',
    status: 'delivered', revenue: '90000', ordered_at: new Date('2026-07-20T10:00:00Z'), items_count: 1,
  })
  await db.insert(yandexSettlementTransactions).values([
    { shop_id: ymShop, transaction_id: 't-old-credit', order_id_external: '800001',
      entry_type: 'Начисление', amount: '90000', transaction_at: new Date('2026-08-14T12:00:00Z') },
    { shop_id: ymShop, transaction_id: 't-old-debit', order_id_external: '800001',
      entry_type: 'Удержание', product_name: 'Поручение на продажу', amount: '17000',
      transaction_at: new Date('2026-08-14T12:00:00Z') },
  ])
  // Overhead with no order behind it, also landing in the empty week: storage.
  // It must not turn W2 into a loss either.
  await db.insert(yandexSettlementTransactions).values({
    shop_id: ymShop, transaction_id: 't-storage', order_id_external: null,
    entry_type: 'Удержание', product_name: 'Хранение', amount: '25000',
    transaction_at: new Date('2026-08-15T12:00:00Z'),
  })

  // ── W3: one sale, 115 000, settled inside its own week.
  const w3 = randomUUID()
  await db.insert(orders).values({
    id: w3, shop_id: ymShop, order_id_external: '800002', marketplace: 'yandex_market',
    status: 'delivered', revenue: '115000', ordered_at: new Date('2026-08-20T10:00:00Z'), items_count: 1,
  })
  await db.insert(yandexSettlementTransactions).values([
    { shop_id: ymShop, transaction_id: 't-w3-credit', order_id_external: '800002',
      entry_type: 'Начисление', amount: '115000', transaction_at: new Date('2026-08-21T12:00:00Z') },
    { shop_id: ymShop, transaction_id: 't-w3-debit', order_id_external: '800002',
      entry_type: 'Удержание', product_name: 'Доставка покупателю', amount: '20000',
      transaction_at: new Date('2026-08-21T12:00:00Z') },
  ])
})

after(async () => {
  const shopIds = [uzShop, ymShop]
  const ords = await db.select({ id: orders.id }).from(orders).where(inArray(orders.shop_id, shopIds))
  if (ords.length > 0) await db.delete(orderItems).where(inArray(orderItems.order_id, ords.map(o => o.id as string)))
  await db.delete(orders).where(inArray(orders.shop_id, shopIds))
  await db.delete(uzumSettlementOrders).where(eq(uzumSettlementOrders.shop_id, uzShop))
  await db.delete(yandexSettlementTransactions).where(eq(yandexSettlementTransactions.shop_id, ymShop))
  await db.delete(products).where(eq(products.shop_id, uzShop))
  await db.delete(shops).where(inArray(shops.id, shopIds))
  await db.delete(users).where(eq(users.id, userId))
  await pool.end()
})

const shopIds = () => [uzShop, ymShop]

describe('the three weeks the seller reported', () => {
  it('W2 — no sales, so no profit, however much payout money landed', async () => {
    // Was +73 000: a Yandex payout for a JULY order, plus storage, both dated
    // inside this week. Neither belongs to a week that sold nothing.
    const k = await fetchPeriodKpis(shopIds(), W2.since, W2.until)
    assert.equal(k.revenue, 0)
    assert.equal(k.orders, 0)
    assert.equal(k.profit, 0, 'an empty week must not inherit another period\'s settlement')
  })

  it('W1 — 200 000 of sales, settled three weeks later, is not a loss', async () => {
    // Was −52 250: 130 000 of COGS charged against settlements that had not
    // arrived. The money follows the sale now, so the week reads:
    //   85 000 + 85 000 settled − 130 000 COGS = 40 000.
    const k = await fetchPeriodKpis(shopIds(), W1.since, W1.until)
    assert.equal(k.revenue, 200000)
    assert.equal(k.orders, 2)
    assert.equal(k.profit, 40000)
    assert.ok(k.profit > 0, 'a week that sold two units above cost is not a loss')
  })

  it('W3 — settled inside its own week, unchanged by the fix', async () => {
    const k = await fetchPeriodKpis(shopIds(), W3.since, W3.until)
    assert.equal(k.revenue, 115000)
    assert.equal(k.profit, 95000)   // 115 000 − 20 000 delivery, no cost price on this product
  })
})

describe('ACCEPTANCE — the two rules that make a wrong number impossible', () => {
  const WINDOWS = [
    { name: 'W1', ...W1 }, { name: 'W2', ...W2 }, { name: 'W3', ...W3 },
    { name: 'all three weeks', since: W1.since, until: W3.until },
    { name: 'W1+W2', since: W1.since, until: W2.until },
    { name: 'W2+W3', since: W2.since, until: W3.until },
    { name: 'a single empty day', since: new Date('2026-08-13T00:00:00Z'), until: new Date('2026-08-13T23:59:59Z') },
    { name: 'the July order alone', since: new Date('2026-07-01T00:00:00Z'), until: new Date('2026-07-31T23:59:59Z') },
  ]

  it('RULE 1 — profit never exceeds the period\'s own sales', async () => {
    // Profit = sales − costs and no cost is negative, so profit > sales is not a
    // number the arithmetic can produce. If it appears, money from outside the
    // period leaked in — which is exactly the bug this file exists for.
    for (const w of WINDOWS) {
      const k = await fetchPeriodKpis(shopIds(), w.since, w.until)
      assert.ok(k.profit <= k.revenue,
        `${w.name}: profit ${k.profit} exceeds revenue ${k.revenue}`)
    }
  })

  it('RULE 2 — a period with no sales is 0, never a loss and never a windfall', async () => {
    for (const w of WINDOWS) {
      const k = await fetchPeriodKpis(shopIds(), w.since, w.until)
      if (k.revenue === 0) {
        assert.equal(k.profit, 0, `${w.name}: no sales but profit ${k.profit}`)
      }
    }
  })

  it('the parts still sum to the whole', async () => {
    const all = await fetchPeriodKpis(shopIds(), W1.since, W3.until)
    const parts = await Promise.all([W1, W2, W3].map(w => fetchPeriodKpis(shopIds(), w.since, w.until)))
    assert.equal(parts.reduce((s, p) => s + p.profit, 0), all.profit)
    assert.equal(parts.reduce((s, p) => s + p.revenue, 0), all.revenue)
  })
})

describe('an order the marketplace has not settled yet', () => {
  it('falls back to the stored estimate rather than counting as zero income', async () => {
    // Without a per-order fallback, a sale made today would have its COGS
    // charged against no income at all — inventing a loss, which is rule 2 in
    // the other direction. The stored fee/delivery estimate stands in until the
    // settlement arrives.
    const id = randomUUID()
    await db.insert(orders).values({
      id, shop_id: uzShop, order_id_external: '900099', marketplace: 'uzum', status: 'delivered',
      revenue: '100000', marketplace_fee: '12000', delivery_cost: '3000',
      ordered_at: new Date('2026-09-02T10:00:00Z'), items_count: 1,
    })
    try {
      const k = await fetchPeriodKpis(shopIds(),
        new Date('2026-09-01T00:00:00Z'), new Date('2026-09-07T23:59:59Z'))
      assert.equal(k.revenue, 100000)
      assert.equal(k.profit, 85000, '100 000 − 12 000 fee − 3 000 delivery, no COGS (no items yet)')
      assert.ok(k.profit <= k.revenue)
    } finally {
      await db.delete(orders).where(eq(orders.id, id))
    }
  })
})

describe('the same clock, for the P&L table', () => {
  // getPnl itself resolves shops through the request-scoped auth context, which
  // a test runner cannot provide — so this holds the piece that actually moved:
  // which bucket a settlement is filed under. P&L keys its buckets off
  // orders.ordered_at, so reading settlements bucketed by payment date put a
  // week's fees in a different row from its sales.
  const ALL = { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-09-30T23:59:59Z') }

  it("files a settlement under the day of its SALE, not the day it was paid", async () => {
    // The Uzum pair sold 6–7 Aug, paid 24 Aug.
    const byOrder = await getRealFinancialsByBucket(shopIds(), ALL.from, 'day', ALL.to, 'order')
    assert.ok((byOrder.get('2026-08-06')?.itemCount ?? 0) > 0, 'nothing filed on the sale date')
    assert.equal(byOrder.get('2026-08-24')?.itemCount ?? 0, 0, 'still filed on the payment date')
  })

  it('leaves the payment clock alone for callers that want it', async () => {
    // Payouts reports when money moved, and must keep doing so.
    const byPayment = await getRealFinancialsByBucket(shopIds(), ALL.from, 'day', ALL.to)
    assert.ok((byPayment.get('2026-08-24')?.itemCount ?? 0) > 0)
    assert.equal(byPayment.get('2026-08-06')?.itemCount ?? 0, 0)
  })

  it('keeps no-order overhead on its payment date instead of dropping it', async () => {
    // The 25 000 storage charge has no order behind it. It is a real cost, so it
    // must not vanish — it just cannot belong to a sale that never happened.
    const byOrder = await getRealFinancialsByBucket(shopIds(), ALL.from, 'day', ALL.to, 'order')
    assert.equal(byOrder.get('2026-08-15')?.other ?? 0, 25000)
  })

  it('the July sale paid in August is filed in July', async () => {
    const byOrder = await getRealFinancialsByBucket(shopIds(), ALL.from, 'day', ALL.to, 'order')
    assert.equal(byOrder.get('2026-07-20')?.net ?? 0, 90000 - 17000)
    assert.equal(byOrder.get('2026-08-14')?.itemCount ?? 0, 0)
  })
})
