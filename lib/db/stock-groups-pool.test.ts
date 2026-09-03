// Pure pool math for the Stocks page. Run:
//   node --import tsx --test lib/db/stock-groups-pool.test.ts
//
// Display uses the marketplace API's own reported stock (stock_quantity),
// the authoritative number the seller sees in their cabinet.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { poolOnHand, groupListedStock } from './stock-groups'

const fbs = (stock: number, physical: number | null) =>
  ({ fulfillment_type: 'fbs' as string | null, stock, physical_stock: physical })
const fbo = (stock: number, physical: number | null) =>
  ({ fulfillment_type: 'fbo' as string | null, stock, physical_stock: physical })

describe('poolOnHand — uses marketplace API stock for display', () => {
  it('shows the marketplace-reported stock, not physical_stock', () => {
    const members = [fbs(1, 2), fbs(1, 2)]
    assert.equal(poolOnHand(members), 1)
    assert.equal(groupListedStock(members), 1)
  })

  it('control: no open order, listing 2 → on-hand 2', () => {
    const members = [fbs(2, 2), fbs(2, 2)]
    assert.equal(poolOnHand(members), 2)
  })

  it('physical_stock is ignored — stock is what matters', () => {
    assert.equal(poolOnHand([fbs(3, null), fbs(3, null)]), 3)
    assert.equal(poolOnHand([fbs(1, null), fbs(1, 2)]), 1)
  })

  it('FBS is MAX (shared pool), FBO is SUM (independent warehouses)', () => {
    assert.equal(poolOnHand([fbs(5, 5), fbs(5, 5)]), 5)         // shared → MAX
    assert.equal(poolOnHand([fbo(2, 2), fbo(3, 3)]), 5)         // independent → SUM
    assert.equal(poolOnHand([fbs(4, 4), fbo(2, 2)]), 6)         // mixed → max(4) + sum(2)
  })

  it('never negative, clamps negative stock to 0', () => {
    assert.equal(poolOnHand([fbs(-1, -3)]), 0)
    assert.equal(poolOnHand([]), 0)
  })
})
