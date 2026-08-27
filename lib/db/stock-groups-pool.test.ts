// Pure pool math for the Stocks page. Run:
//   node --import tsx --test lib/db/stock-groups-pool.test.ts
//
// Guards the double-count bug: available must read physical_stock (the real pool),
// never the marketplace listing mirror (already decremented for the open order).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { poolOnHand, groupListedStock } from './stock-groups'

const fbs = (stock: number, physical: number | null) =>
  ({ fulfillment_type: 'fbs' as string | null, stock, physical_stock: physical })
const fbo = (stock: number, physical: number | null) =>
  ({ fulfillment_type: 'fbo' as string | null, stock, physical_stock: physical })

describe('poolOnHand — physical_stock is the pool, not the listing mirror', () => {
  it('THE KBWHT case: listing 1/1 but physical 2/2 → on-hand 2 (available 2−1=1, not 0)', () => {
    // Marketplace already decremented each listing to 1 for the one open order;
    // physical_stock still holds the true 2. Reading the listing would give
    // max(1) − 1 = 0 and tell the seller they're out with a sellable unit on hand.
    const members = [fbs(1, 2), fbs(1, 2)]
    assert.equal(poolOnHand(members), 2)              // MAX physical, NOT listing
    assert.equal(groupListedStock(members), 1)        // the mirror, for display only
    const reserved = 1
    assert.equal(Math.max(0, poolOnHand(members) - reserved), 1)  // available
  })

  it('control KBBLK: no open order, physical 2/2 → on-hand 2, available 2', () => {
    const members = [fbs(2, 2), fbs(2, 2)]
    assert.equal(poolOnHand(members), 2)
    assert.equal(Math.max(0, poolOnHand(members) - 0), 2)
  })

  it('falls back to the listing only to SEED a null physical_stock', () => {
    assert.equal(poolOnHand([fbs(3, null), fbs(3, null)]), 3)   // both null → 3
    assert.equal(poolOnHand([fbs(1, null), fbs(1, 2)]), 2)      // one seeded, one real → MAX(1,2)
  })

  it('FBS is MAX (shared pool), FBO is SUM (independent warehouses)', () => {
    assert.equal(poolOnHand([fbs(5, 5), fbs(5, 5)]), 5)         // shared → MAX
    assert.equal(poolOnHand([fbo(2, 2), fbo(3, 3)]), 5)         // independent → SUM
    assert.equal(poolOnHand([fbs(4, 4), fbo(2, 2)]), 6)         // mixed → max(4) + sum(2)
  })

  it('never negative, clamps negative physical to 0', () => {
    assert.equal(poolOnHand([fbs(-1, -3)]), 0)
    assert.equal(poolOnHand([]), 0)
  })
})
