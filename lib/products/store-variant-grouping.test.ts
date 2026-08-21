import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByStoreVariant } from './store-variant-grouping'

type Row = { sku: string; variant_group_key: string | null; marketplace: string | null }
const row = (sku: string, key: string | null, mp: string | null): Row =>
  ({ sku, variant_group_key: key, marketplace: mp })

// The GTX350 case: two colours listed on both stores, four rows in the table.
const GTX = [
  row('KBWHT', 'uzum:350',   'uzum'),
  row('KBBLK', 'uzum:350',   'uzum'),
  row('KBWHT', 'yandex:G350', 'yandex_market'),
  row('KBBLK', 'yandex:G350', 'yandex_market'),
]

test('colours of one product in one store collapse into one group', () => {
  const out = groupByStoreVariant(GTX)
  assert.equal(out.length, 2, 'four listings become two store groups')
  assert.ok(out.every(i => i.type === 'group'))
})

test('the two stores never merge into a single group', () => {
  const out = groupByStoreVariant(GTX)
  const stores = out.map(i => i.type === 'group' ? [...new Set(i.children.map(c => c.marketplace))] : [])
  for (const s of stores) assert.equal(s.length, 1, 'each group is one store only')
  assert.deepEqual(stores.flat().sort(), ['uzum', 'yandex_market'])
})

// The bucket id carries the marketplace even though the key already implies it.
// If a future sync ever emitted a bare key, this is what still keeps stores apart.
test('an unnamespaced key shared by two stores still does not merge them', () => {
  const out = groupByStoreVariant([
    row('A', 'M9', 'uzum'), row('B', 'M9', 'uzum'),
    row('A', 'M9', 'yandex_market'), row('B', 'M9', 'yandex_market'),
  ])
  assert.equal(out.length, 2)
  for (const i of out) {
    if (i.type !== 'group') continue
    assert.equal(new Set(i.children.map(c => c.marketplace)).size, 1)
  }
})

test('a lone listing stays a plain row, no chevron over one child', () => {
  const out = groupByStoreVariant([row('SOLO', 'uzum:1', 'uzum'), ...GTX])
  const solo = out.find(i => i.type === 'flat')
  assert.ok(solo && solo.type === 'flat' && solo.product.sku === 'SOLO')
})

test('a null group key never groups, even against an identical null', () => {
  const out = groupByStoreVariant([row('X', null, 'uzum'), row('Y', null, 'uzum')])
  assert.equal(out.length, 2)
  assert.ok(out.every(i => i.type === 'flat'))
})

test('a group sits where its first member sat — sort order survives', () => {
  const out = groupByStoreVariant([
    row('AAA', null, 'uzum'),
    row('KBWHT', 'uzum:350', 'uzum'),
    row('ZZZ', null, 'uzum'),
    row('KBBLK', 'uzum:350', 'uzum'),
  ])
  assert.deepEqual(
    out.map(i => i.type === 'flat' ? i.product.sku : 'GROUP'),
    ['AAA', 'GROUP', 'ZZZ'],
  )
})

test('every input row is emitted exactly once', () => {
  const rows = [...GTX, row('SOLO', null, 'uzum')]
  const out = groupByStoreVariant(rows)
  const seen = out.flatMap(i => i.type === 'group' ? i.children : [i.product])
  assert.equal(seen.length, rows.length)
  assert.deepEqual(new Set(seen).size, rows.length)
})
