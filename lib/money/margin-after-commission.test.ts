/**
 * Margin after commission — revenue minus the marketplace's cut, over counted
 * orders only, with NO cost data. Pure — no DB.
 * Run: node --import tsx --test lib/money/margin-after-commission.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sumEconomics, marginAfterCommission, type OrderInput } from './order-economics'

const mk = (o: Partial<OrderInput & { key: string }> = {}): OrderInput & { key: string } => ({
  revenue: 100_000, marketplaceFee: null, deliveryCost: null, cogs: null, key: 'uzum', ...o,
})

describe('margin after commission', () => {
  it('is revenue − reported commission over the counted orders', () => {
    const totals = sumEconomics([mk({ marketplaceFee: 20_000, cogs: 60_000 })])
    assert.equal(marginAfterCommission(totals), 100_000 - 20_000)
  })

  it('never touches cost — a missing cost_price does not change it', () => {
    const withCost = sumEconomics([mk({ marketplaceFee: 20_000, cogs: 60_000 })])
    const noCost   = sumEconomics([mk({ marketplaceFee: 20_000, cogs: null })])
    assert.equal(marginAfterCommission(withCost), marginAfterCommission(noCost))
    assert.equal(marginAfterCommission(noCost), 80_000)
  })

  it('EXCLUDES an unreported-fee order — it is pending, not zero-fee margin', () => {
    // The real screenshot shape: Uzum counted, Yandex awaiting settlement.
    const totals = sumEconomics([
      mk({ key: 'uzum',          revenue: 200_000, marketplaceFee: 44_500, cogs: 130_000 }),
      mk({ key: 'yandex_market', revenue: 115_000, marketplaceFee: null }),
    ])
    // Only Uzum: 200 000 − 44 500. Yandex's 115 000 is NOT counted as margin.
    assert.equal(marginAfterCommission(totals), 200_000 - 44_500)
    assert.equal(totals.excluded.length, 1)
    assert.equal(totals.excluded[0].key, 'yandex_market')
    assert.equal(totals.excluded[0].reason, 'fee_not_reported')
    assert.equal(totals.excluded[0].revenue, 115_000)
  })

  it('treats a DERIVED (estimated) fee as unreported — excluded, not counted', () => {
    const totals = sumEconomics([mk({ marketplaceFee: 17_000, feeSource: 'derived' })])
    assert.equal(marginAfterCommission(totals), 0)
    assert.equal(totals.excluded.length, 1)
    assert.equal(totals.excluded[0].reason, 'fee_not_reported')
  })

  it('uses the real settlement as the cut — margin equals what was paid out', () => {
    const totals = sumEconomics([mk({ revenue: 100_000, settlementNet: 77_750 })])
    assert.equal(marginAfterCommission(totals), 77_750)
  })

  it('counts delivery as part of the marketplace cut', () => {
    const totals = sumEconomics([mk({ marketplaceFee: 20_000, deliveryCost: 5_000 })])
    assert.equal(marginAfterCommission(totals), 100_000 - 25_000)
  })

  it('everything pending → margin 0, all revenue surfaced as excluded', () => {
    const totals = sumEconomics([mk({ marketplaceFee: null })])
    assert.equal(marginAfterCommission(totals), 0)
    assert.equal(totals.countedRevenue, 0)
    assert.equal(totals.excluded[0].revenue, 100_000)
  })
})
