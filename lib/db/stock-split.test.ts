import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { groupListedStock, groupListedStockSplit } from './stock-groups'

const m = (fulfillment_type: string | null, stock: number) =>
  ({ fulfillment_type, stock, physical_stock: null })

describe('fulfilment split of listed stock', () => {
  test('FBO/FBY warehouses ADD — they hold independent inventory', () => {
    const s = groupListedStockSplit([m('fbo', 3), m('fby', 4)])
    assert.equal(s.fbo, 7)
    assert.equal(s.fbs, 0)
  })

  test('FBS members MAX — one physical pool listed on every marketplace', () => {
    // Summing these would invent a unit that does not exist, which is the
    // direction that lets a seller oversell.
    const s = groupListedStockSplit([m('fbs', 5), m('fbs', 5)])
    assert.equal(s.fbs, 5)
    assert.equal(s.fbo, 0)
  })

  test('unknown fulfilment is treated as FBS — undercount beats invent', () => {
    assert.equal(groupListedStockSplit([m(null, 2), m(null, 2)]).fbs, 2)
  })

  test('a mixed group adds the FBO side to the FBS pool', () => {
    const s = groupListedStockSplit([m('fbo', 3), m('fbs', 5)])
    assert.equal(s.fbo, 3)
    assert.equal(s.fbs, 5)
  })

  test('the split always reconstructs the total it came from', () => {
    for (const members of [
      [m('fbo', 3), m('fbs', 5)],
      [m('fbs', 5), m('fbs', 2)],
      [m('fby', 1), m('fbo', 1), m(null, 9)],
      [],
    ]) {
      const s = groupListedStockSplit(members)
      assert.equal(s.fbo + s.fbs, groupListedStock(members),
        'a breakdown that does not add up to the figure above it is worse than none')
    }
  })

  test('negative marketplace numbers never become negative stock', () => {
    const s = groupListedStockSplit([m('fbo', -4), m('fbs', -2)])
    assert.equal(s.fbo, 0)
    assert.equal(s.fbs, 0)
  })
})
