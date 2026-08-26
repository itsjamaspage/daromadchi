/**
 * The dashboard's Чистая прибыль must describe the SELECTED PERIOD and nothing
 * outside it.
 *
 * The bug: fetchPeriodKpis totalled settlement buckets from
 * getRealFinancialsByBucket, which took only a `from` bound. So the profit KPI
 * was "every settlement since the window opened, to forever" minus "the COGS of
 * this window" — two different periods subtracted from each other. A week with
 * no orders had no COGS to subtract and displayed the entire remaining tail as
 * profit, and every earlier week showed a bigger number than the week after it.
 * The seller saw 421 300 profit on a week with 0 revenue and 0 orders.
 *
 * There is no pure function to unit-test here: the bound is a SQL predicate, so
 * the only honest test runs the real query against a real Postgres. Deleting the
 * `to` argument in kpis.ts, or the lte() in real-financials.ts, makes the first
 * two tests below fail.
 *
 * Run: DATABASE_URL=postgres://… node --conditions=react-server --import tsx \
 *        --test lib/db/kpis.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db, pool, users, shops, orders, uzumSettlementOrders } from '@/lib/db'
import { fetchPeriodKpis } from '@/lib/db/kpis-period'

// Three weeks. The seller sold nothing in WEEK 2 — that is the window whose
// profit was wrong, because the settlements of week 3 leaked into it.
const WEEK1 = { since: new Date('2026-08-05T00:00:00Z'), until: new Date('2026-08-11T23:59:59Z') }
const WEEK2 = { since: new Date('2026-08-12T00:00:00Z'), until: new Date('2026-08-18T23:59:59Z') }
const WEEK3 = { since: new Date('2026-08-19T00:00:00Z'), until: new Date('2026-08-25T23:59:59Z') }

let userId: string
let shopId: string

before(async () => {
  userId = randomUUID()
  shopId = randomUUID()
  await db.insert(users).values({ id: userId, email: `kpis-${userId.slice(0, 8)}@test.local` })
  await db.insert(shops).values({
    id: shopId, user_id: userId, name: 'kpis-test', marketplace: 'uzum',
  })

  // A delivered order in week 1, settled in week 1.
  await db.insert(orders).values({
    shop_id: shopId, order_id_external: `w1-${shopId.slice(0, 8)}`, marketplace: 'uzum',
    status: 'delivered', revenue: '200000', ordered_at: new Date('2026-08-06T10:00:00Z'),
    items_count: 1,
  })
  // Nothing at all in week 2.
  // A delivered order in week 3, settled in week 3.
  await db.insert(orders).values({
    shop_id: shopId, order_id_external: `w3-${shopId.slice(0, 8)}`, marketplace: 'uzum',
    status: 'delivered', revenue: '115000', ordered_at: new Date('2026-08-20T10:00:00Z'),
    items_count: 1,
  })

  await db.insert(uzumSettlementOrders).values([
    {
      shop_id: shopId, uzum_order_item_id: 9001, uzum_order_id: 9001, status: 'TO_WITHDRAW',
      transaction_at: new Date('2026-08-06T12:00:00Z'),
      seller_price: '200000', commission: '0', logistic_delivery_fee: '0', seller_profit: '150000',
    },
    {
      shop_id: shopId, uzum_order_item_id: 9003, uzum_order_id: 9003, status: 'TO_WITHDRAW',
      transaction_at: new Date('2026-08-20T12:00:00Z'),
      seller_price: '115000', commission: '0', logistic_delivery_fee: '0', seller_profit: '90000',
    },
  ])
})

after(async () => {
  await db.delete(orders).where(eq(orders.shop_id, shopId))
  await db.delete(uzumSettlementOrders).where(eq(uzumSettlementOrders.shop_id, shopId))
  await db.delete(shops).where(eq(shops.id, shopId))
  await db.delete(users).where(inArray(users.id, [userId]))
  await pool.end()
})

describe('period KPIs are bounded on BOTH sides', () => {
  it('a week with no orders reports no profit — not the tail of later weeks', async () => {
    // THE regression. Before the fix this returned 90 000: week 3's settlement,
    // which had not happened yet as far as this window is concerned.
    const k = await fetchPeriodKpis([shopId], WEEK2.since, WEEK2.until)
    assert.equal(k.revenue, 0)
    assert.equal(k.orders, 0)
    assert.equal(k.profit, 0, 'an empty week must not inherit a later week\'s settlement')
  })

  it('week 1 sees its own settlement and not week 3\'s', async () => {
    const k = await fetchPeriodKpis([shopId], WEEK1.since, WEEK1.until)
    assert.equal(k.revenue, 200000)
    assert.equal(k.orders, 1)
    assert.equal(k.profit, 150000, 'week 1 profit must exclude the 90 000 settled in week 3')
  })

  it('week 3 sees its own settlement and not week 1\'s', async () => {
    const k = await fetchPeriodKpis([shopId], WEEK3.since, WEEK3.until)
    assert.equal(k.revenue, 115000)
    assert.equal(k.orders, 1)
    assert.equal(k.profit, 90000)
  })

  it('the weeks sum to the whole span — the property the old code broke', async () => {
    // With an unbounded tail the parts overdeliver against the whole; that
    // inconsistency is what the seller noticed before anyone read the query.
    const all = await fetchPeriodKpis([shopId], WEEK1.since, WEEK3.until)
    const parts = await Promise.all(
      [WEEK1, WEEK2, WEEK3].map(w => fetchPeriodKpis([shopId], w.since, w.until)),
    )
    assert.equal(parts.reduce((s, p) => s + p.profit, 0), all.profit)
    assert.equal(parts.reduce((s, p) => s + p.revenue, 0), all.revenue)
    assert.equal(parts.reduce((s, p) => s + p.orders, 0), all.orders)
  })
})
