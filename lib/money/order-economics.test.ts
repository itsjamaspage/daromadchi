/**
 * The money rules, as arithmetic. Pure — no DB.
 * Run: node --import tsx --test lib/money/order-economics.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderEconomics, sumEconomics, addKnown, known, notKnown } from './order-economics'

const order = (o: Partial<Parameters<typeof orderEconomics>[0]> = {}) => ({
  revenue: 100000, marketplaceFee: null, deliveryCost: null, cogs: null, ...o,
})

describe('an absent value is never a zero', () => {
  it('a Yandex order with no settlement yet has UNKNOWN fees, not free ones', () => {
    // The reported bug: this returned 115 000 of profit on 115 000 of sales.
    const e = orderEconomics(order({ revenue: 115000, cogs: 0 }))
    assert.equal(e.fees.known, false)
    assert.equal(e.fees.known === false && e.fees.reason, 'fee_not_reported')
    assert.equal(e.net.known, false, 'no net without fees')
  })

  it('a product with no cost price has UNKNOWN cogs, not free goods', () => {
    // The powerbanks: 100% margin because nobody entered what they cost.
    const e = orderEconomics(order({ marketplaceFee: 17000, cogs: null }))
    assert.equal(e.cogs.known, false)
    assert.equal(e.cogs.known === false && e.cogs.reason, 'cost_not_set')
    assert.equal(e.net.known, false)
  })

  it('a zero fee IS known — the marketplace said zero', () => {
    // Distinguishing 0 from unknown is the whole point.
    const e = orderEconomics(order({ marketplaceFee: 0, deliveryCost: 0, cogs: 0 }))
    assert.deepEqual(e.fees, known(0))
    assert.deepEqual(e.net, known(100000))
  })
})

describe('what the order earned', () => {
  it('prefers the settlement over the stored estimate', () => {
    // The settlement is what the marketplace actually paid; the stored fee is an
    // estimate from sync time.
    const e = orderEconomics(order({ marketplaceFee: 20000, deliveryCost: 5000, settlementNet: 77750, cogs: 65000 }))
    assert.deepEqual(e.fees, known(100000 - 77750))
    assert.deepEqual(e.net, known(100000 - 22250 - 65000))
  })

  it('falls back to the stored fee and delivery when there is no settlement', () => {
    const e = orderEconomics(order({ marketplaceFee: 17000, deliveryCost: 5250, cogs: 65000 }))
    assert.deepEqual(e.fees, known(22250))
    assert.deepEqual(e.net, known(12750))
  })

  it('a real loss stays a loss', () => {
    // Sold below cost. Not a timing artefact — a genuine negative, and the type
    // must not launder it into an unknown.
    const e = orderEconomics(order({ revenue: 76000, marketplaceFee: 15200, cogs: 77000 }))
    assert.deepEqual(e.net, known(76000 - 15200 - 77000))
    assert.ok(e.net.known && e.net.value < 0)
  })
})

describe('addKnown — unknowns are contagious', () => {
  it('sums when everything is known', () => {
    assert.deepEqual(addKnown(known(1), known(2), known(3)), known(6))
  })
  it('returns the first reason otherwise', () => {
    assert.deepEqual(addKnown(known(1), notKnown('cost_not_set'), known(3)),
      notKnown('cost_not_set'))
  })
  it('an empty sum is a known zero', () => {
    assert.deepEqual(addKnown(), known(0))
  })
})

describe('totalling a period', () => {
  const uzum = (o = {}) => ({ key: 'uzum', ...order({ marketplaceFee: 17000, deliveryCost: 5250, cogs: 65000 }), ...o })
  const yandexPending = (o = {}) => ({ key: 'yandex_market', ...order({ revenue: 115000, cogs: 0 }), ...o })

  it('counts what the marketplace has reported and sets aside what it has not', () => {
    const t = sumEconomics([uzum(), yandexPending()])
    assert.equal(t.revenue, 215000, 'every sale still counts as a sale')
    assert.equal(t.countedRevenue, 100000)
    assert.equal(t.net, 12750)
    assert.deepEqual(t.counted, ['uzum'])
    assert.deepEqual(t.excluded, [
      { key: 'yandex_market', reason: 'fee_not_reported', revenue: 115000, orders: 1 },
    ])
  })

  it('an excluded order takes its cost with it', () => {
    const t = sumEconomics([uzum(), yandexPending({ cogs: 90000 })])
    assert.equal(t.cogs, 65000, 'only the counted order contributes cost')
    assert.equal(t.countedRevenue - t.fees - t.cogs, t.net)
  })

  // ── The two unknowns are treated differently, on purpose ──────────────────
  it('a missing COST does not exclude the order — it flags the total', () => {
    // The seller can fix a missing cost in a minute. Excluding the order would
    // leave someone who has never entered one staring at a profit of zero
    // forever, which teaches nothing. So it counts at zero cost and says so.
    const t = sumEconomics([uzum({ cogs: null })])
    assert.equal(t.countedRevenue, 100000)
    assert.equal(t.cogs, 0)
    assert.equal(t.net, 100000 - 22250)
    assert.deepEqual(t.costMissing, { orders: 1, revenue: 100000 })
    assert.deepEqual(t.excluded, [], 'not excluded — flagged')
  })

  it('a missing FEE does exclude it — nobody can make that number appear', () => {
    const t = sumEconomics([yandexPending()])
    assert.equal(t.countedRevenue, 0)
    assert.equal(t.net, 0)
    assert.equal(t.costMissing.orders, 0)
    assert.equal(t.excluded[0].reason, 'fee_not_reported')
  })

  it('both at once: one waits, the other is flagged', () => {
    const t = sumEconomics([uzum({ cogs: null }), yandexPending()])
    assert.equal(t.costMissing.orders, 1)
    assert.equal(t.excluded.length, 1)
    assert.equal(t.excluded[0].key, 'yandex_market')
  })

  it('never reports a profit above the sales behind it', () => {
    // The acceptance rule, as an invariant of the summing itself.
    for (const set of [
      [uzum()], [yandexPending()], [uzum(), yandexPending()],
      [uzum({ cogs: null })], [uzum({ marketplaceFee: null, deliveryCost: null })], [],
    ]) {
      const t = sumEconomics(set)
      assert.ok(t.net <= t.countedRevenue, `net ${t.net} > counted ${t.countedRevenue}`)
      assert.ok(t.net <= t.revenue, `net ${t.net} > revenue ${t.revenue}`)
    }
  })

  it('a period where the marketplace has reported nothing totals zero', () => {
    const t = sumEconomics([yandexPending(), yandexPending()])
    assert.equal(t.revenue, 230000)
    assert.equal(t.countedRevenue, 0)
    assert.equal(t.net, 0)
    assert.deepEqual(t.counted, [])
    assert.equal(t.excluded[0].orders, 2)
  })

  it('an empty period is all zeros', () => {
    const t = sumEconomics([])
    assert.deepEqual([t.revenue, t.countedRevenue, t.fees, t.cogs, t.net], [0, 0, 0, 0, 0])
    assert.deepEqual(t.costMissing, { orders: 0, revenue: 0 })
  })
})
