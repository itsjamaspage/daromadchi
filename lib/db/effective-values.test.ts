import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effective, groupSharedValues } from '@/lib/products/effective-values'
import type { Product } from '@/lib/types'

const P = (o: Partial<Product>): Product => ({
  id: 'p1', shop_id: 's1', sku: 'A', title: 'x',
  cost_price: null, selling_price: null, stock_quantity: 0, physical_stock: null,
  category: null, marketplace_product_id: null, fulfillment_type: 'fbs',
  updated_at: '', available_stock: 0, total_physical: 0, profit: 0,
  sold: 0, delivered: 0, in_transit: 0, cancelled: 0, is_shared: false,
  variant_group_key: null, variant_color: null,
  ...o,
} as Product)

// NULL override = show what the marketplace reports. That is the default for
// every existing row and the state a seller returns to by clearing the field.

test('no override falls through to the marketplace value', () => {
  const e = effective(P({ selling_price: 100_000, available_stock: 7 }))
  assert.equal(e.price, 100_000)
  assert.equal(e.stockQty, 7)
  assert.equal(e.priceOverridden, false)
  assert.equal(e.stockOverridden, false)
})

test('an override replaces it', () => {
  const e = effective(P({ selling_price: 100_000, available_stock: 7, price_override: 120_000, stock_override: 3 }))
  assert.equal(e.price, 120_000)
  assert.equal(e.stockQty, 3)
  assert.equal(e.priceOverridden, true)
  assert.equal(e.stockOverridden, true)
})

test('the two overrides are independent', () => {
  const e = effective(P({ selling_price: 100_000, available_stock: 7, price_override: 90_000 }))
  assert.equal(e.price, 90_000)
  assert.equal(e.stockQty, 7, 'stock still comes from the marketplace')
  assert.equal(e.stockOverridden, false)
})

test('zero is a real override, not "unset"', () => {
  // The distinction that makes clearing work: 0 must not be read as absent, or
  // a seller could never say "I actually have none of this".
  const e = effective(P({ selling_price: 100_000, available_stock: 7, price_override: 0, stock_override: 0 }))
  assert.equal(e.price, 0)
  assert.equal(e.stockQty, 0)
  assert.equal(e.priceOverridden, true)
  assert.equal(e.stockOverridden, true)
})

test('a missing marketplace price reads as 0, not NaN', () => {
  const e = effective(P({ selling_price: null, available_stock: 2 }))
  assert.equal(e.price, 0)
  assert.ok(!Number.isNaN(e.price))
})

test('cost has no override twin — it is already the seller\'s own field', () => {
  // Both syncs omit cost_price from their UPDATE patches, so a hand-entered
  // cost already survives. A second column for it would be dead weight.
  assert.equal(effective(P({ cost_price: 40_000 })).cost, 40_000)
  assert.equal(effective(P({ cost_price: null })).cost, 0)
})

// ── The identities the table renders from these three ───────────────────────

test('profit and margin follow an overridden price', () => {
  const e = effective(P({ selling_price: 100_000, cost_price: 60_000, price_override: 80_000 }))
  const profit = e.price - e.cost
  assert.equal(profit, 20_000, 'profit is off the OVERRIDE, not selling_price')
  assert.equal(((profit / e.price) * 100).toFixed(1), '25.0')
})

test('stock value follows an overridden stock', () => {
  const e = effective(P({ cost_price: 5_000, available_stock: 10, stock_override: 4 }))
  assert.equal(e.cost * e.stockQty, 20_000)
})

test('margin is 0-safe when there is no price', () => {
  const e = effective(P({ cost_price: 5_000 }))
  assert.equal(e.price, 0)
  // The table guards with `price > 0`, so this must never be computed as -Infinity.
  assert.equal(e.price > 0, false)
})

// ── Parent (variant group) rows ─────────────────────────────────────────────
// A parent covers several listings. It may only show one number when they all
// agree; otherwise it says "mixed" rather than presenting one member's value
// as the group's.

test('a group that agrees shows the shared value', () => {
  const g = groupSharedValues([
    P({ id: 'a', selling_price: 100_000, cost_price: 40_000 }),
    P({ id: 'b', selling_price: 100_000, cost_price: 40_000 }),
  ])
  assert.equal(g.price, 100_000)
  assert.equal(g.cost, 40_000)
  assert.equal(g.priceMixed, false)
  assert.equal(g.costMixed, false)
})

test('a group that disagrees reports mixed and shows no number', () => {
  const g = groupSharedValues([
    P({ id: 'a', selling_price: 100_000, cost_price: 40_000 }),
    P({ id: 'b', selling_price: 120_000, cost_price: 40_000 }),
  ])
  assert.equal(g.price, null, 'must not present one member\'s price as the group\'s')
  assert.equal(g.priceMixed, true)
  assert.equal(g.cost, 40_000, 'cost still agrees, so it still shows')
  assert.equal(g.costMixed, false)
})

test('an override on one member makes the group price mixed', () => {
  const g = groupSharedValues([
    P({ id: 'a', selling_price: 100_000 }),
    P({ id: 'b', selling_price: 100_000, price_override: 90_000 }),
  ])
  assert.equal(g.priceMixed, true)
  assert.equal(g.price, null)
})

test('the override dot needs EVERY member overridden, not one', () => {
  // Otherwise the group claims to be the seller's numbers while a member is
  // still live marketplace data.
  const partly = groupSharedValues([
    P({ id: 'a', selling_price: 100_000, price_override: 90_000 }),
    P({ id: 'b', selling_price: 100_000 }),
  ])
  assert.equal(partly.priceOverridden, false)
  const all = groupSharedValues([
    P({ id: 'a', selling_price: 100_000, price_override: 90_000 }),
    P({ id: 'b', selling_price: 100_000, price_override: 90_000 }),
  ])
  assert.equal(all.priceOverridden, true)
})

test('a group with no cost set reads as empty, not as a confident zero', () => {
  const g = groupSharedValues([P({ id: 'a' }), P({ id: 'b' })])
  assert.equal(g.cost, null, 'the cell should offer "+ cost", not show 0')
  assert.equal(g.costMixed, false)
})

test('one member with a cost and one without is mixed', () => {
  const g = groupSharedValues([P({ id: 'a', cost_price: 40_000 }), P({ id: 'b' })])
  assert.equal(g.costMixed, true)
  assert.equal(g.cost, null)
})

test('a single-listing group behaves like that listing', () => {
  const g = groupSharedValues([P({ id: 'a', selling_price: 100_000, cost_price: 40_000 })])
  assert.equal(g.price, 100_000)
  assert.equal(g.priceMixed, false)
})

test('an empty group does not claim to be overridden', () => {
  const g = groupSharedValues([])
  assert.equal(g.priceOverridden, false)
  assert.equal(g.price, null)
  assert.equal(g.priceMixed, false)
})
