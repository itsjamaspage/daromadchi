import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupStockAlerts, stockAlertKey } from './stock-alert-group'
import type { StockAlert } from '@/lib/types'

const A = (o: Partial<StockAlert>): StockAlert => ({
  productId: 'p1', productTitle: 'x', sku: 'JMJ16WH', currentStock: 5, threshold: 15,
  daysLeft: 30, dailySales: 0, marketplace: 'uzum', isShared: false, totalPhysical: 5,
  ...o,
} as StockAlert)

// The reported bug: the same product appeared twice — once in Russian from
// Yandex, once in Uzbek from Uzum — at two different urgencies.

test('one product listed on two marketplaces collapses to one row', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', marketplace: 'uzum', productTitle: 'J16 TWS quloqchin' }),
    A({ productId: 'p2', marketplace: 'yandex_market', productTitle: 'Наушники J16 TWS' }),
  ])
  assert.equal(out.length, 1)
})

test('the merged row is flagged as shared across marketplaces', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', marketplace: 'uzum', isShared: false }),
    A({ productId: 'p2', marketplace: 'yandex_market', isShared: false }),
  ])
  assert.equal(out[0].isShared, true)
})

test('two listings on the SAME marketplace do not read as shared', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', marketplace: 'uzum' }),
    A({ productId: 'p2', marketplace: 'uzum' }),
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].isShared, false)
})

// ── The worst case must survive the merge ───────────────────────────────────
// A healthy listing must never mask an empty one — that is the failure the
// page exists to prevent.

test('a sold-out channel wins over a stocked one', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', currentStock: 9, daysLeft: 40 }),
    A({ productId: 'p2', currentStock: 0, daysLeft: 0 }),
  ])
  assert.equal(out[0].currentStock, 0)
  assert.equal(out[0].daysLeft, 0)
})

test('order of the inputs does not change the result', () => {
  const a = A({ productId: 'p1', currentStock: 9, daysLeft: 40 })
  const b = A({ productId: 'p2', currentStock: 0, daysLeft: 0 })
  assert.deepEqual(groupStockAlerts([a, b])[0].currentStock, groupStockAlerts([b, a])[0].currentStock)
})

// ── Keying ──────────────────────────────────────────────────────────────────

test('SKUs are normalized the same way the rest of the app groups them', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', sku: 'JM-J16_WH' }),
    A({ productId: 'p2', sku: ' jmj16wh ' }),
  ])
  assert.equal(out.length, 1)
})

test('different SKUs stay separate', () => {
  const out = groupStockAlerts([A({ productId: 'p1', sku: 'AAA' }), A({ productId: 'p2', sku: 'BBB' })])
  assert.equal(out.length, 2)
})

test('rows with no SKU are never merged together', () => {
  // Merging unidentified rows would invent a relationship between two products
  // we cannot actually tell apart.
  const out = groupStockAlerts([
    A({ productId: 'p1', sku: '' }),
    A({ productId: 'p2', sku: '' }),
  ])
  assert.equal(out.length, 2)
})

test('an empty SKU key can never collide with a real one', () => {
  assert.notEqual(stockAlertKey({ sku: '', productId: 'p1' }), stockAlertKey({ sku: 'p1', productId: 'zz' }))
})

// ── Output shape ────────────────────────────────────────────────────────────

test('the fuller product title survives', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', productTitle: 'J16' }),
    A({ productId: 'p2', productTitle: 'Наушники J16 TWS Bluetooth' }),
  ])
  assert.equal(out[0].productTitle, 'Наушники J16 TWS Bluetooth')
})

test('rows come back most-urgent first', () => {
  const out = groupStockAlerts([
    A({ productId: 'p1', sku: 'A', daysLeft: 40 }),
    A({ productId: 'p2', sku: 'B', daysLeft: 2 }),
    A({ productId: 'p3', sku: 'C', daysLeft: 9 }),
  ])
  assert.deepEqual(out.map(r => r.daysLeft), [2, 9, 40])
})

test('an empty input gives an empty list, not a crash', () => {
  assert.deepEqual(groupStockAlerts([]), [])
})
