/**
 * The regression this pins: a restocked SKU must never read 0 because the
 * card's lifecycle status has not caught up.
 *
 * Run: node --import tsx --test lib/uzum/stock-reading.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { uzumStockQuantity, uzumRawStock, UZUM_RUN_OUT } from './stock-reading'

describe('uzumStockQuantity — the RUN_OUT freeze', () => {
  it('reports a restocked SKU even while the card still says RUN_OUT', () => {
    // KBWHT: seller set 2 on Uzum, card lifecycle lagging. This returned 0
    // before, on every heavy pass, forever.
    assert.equal(uzumStockQuantity({ quantityActive: 2, quantityFbs: 0 }), 2)
    assert.equal(uzumStockQuantity({ quantityActive: 0, quantityFbs: 2 }), 2)
    assert.equal(uzumStockQuantity({ quantityActive: 1, quantityFbs: 1 }), 2)
  })

  it('still reports 0 when the quantities are genuinely 0', () => {
    assert.equal(uzumStockQuantity({ quantityActive: 0, quantityFbs: 0 }), 0)
    assert.equal(uzumStockQuantity({}), 0)
    assert.equal(uzumStockQuantity({ quantityActive: null, quantityFbs: null }), 0)
  })

  it('sums both fulfilment buckets rather than picking one', () => {
    assert.equal(uzumRawStock({ quantityActive: 3, quantityFbs: 4 }), 7)
  })

  it('never stores a negative quantity', () => {
    // Uzum has no meaning for this; clamp instead of persisting nonsense.
    assert.equal(uzumStockQuantity({ quantityActive: -5, quantityFbs: 0 }), 0)
    assert.equal(uzumStockQuantity({ quantityActive: -5, quantityFbs: 8 }), 3)
  })

  it('survives non-numeric junk without writing NaN', () => {
    assert.equal(uzumStockQuantity({ quantityActive: NaN, quantityFbs: 2 }), 2)
    assert.equal(uzumStockQuantity({ quantityActive: undefined, quantityFbs: 5 }), 5)
  })

  it('keeps RUN_OUT documented but out of the arithmetic', () => {
    // The constant stays exported so the status stays greppable; the point is
    // that no call signature lets it zero a positive quantity any more.
    assert.equal(UZUM_RUN_OUT, 'RUN_OUT')
    assert.equal(uzumStockQuantity.length, 1)   // takes the SKU only
  })
})
