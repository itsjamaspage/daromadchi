import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByVariant } from './variant-grouping'

type Row = { id: string; sku: string | null; variant_group_key: string | null }
const row = (id: string, sku: string | null, key: string | null): Row =>
  ({ id, sku, variant_group_key: key })

// The M9 case that started this. Four listings exist — black and white on each
// marketplace — but only two of them sold: black on Uzum, white on Yandex. The
// two listings that share a SKU across marketplaces (and so weld the namespaced
// group keys together) are exactly the two that did NOT sell.
const SOLD = [
  row('p1', 'JMBLK', 'uzum:M9'),
  row('p2', 'JMWHT', 'yandex:M9'),
]
const ALL_LISTINGS = [
  row('p1', 'JMBLK', 'uzum:M9'),
  row('p2', 'JMWHT', 'yandex:M9'),
  row('p3', 'JMBLK', 'yandex:M9'),   // welds uzum:M9 ↔ yandex:M9 via JMBLK
  row('p4', 'JMWHT', 'uzum:M9'),
]

test('without the bridge the two sold colours cannot see each other', () => {
  const out = groupByVariant(SOLD)
  assert.equal(out.length, 2)
  assert.ok(out.every(i => i.type === 'flat'))
})

test('bridging on the full listing set merges them under one parent', () => {
  const out = groupByVariant(SOLD, ALL_LISTINGS)
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'parent')
  if (out[0].type !== 'parent') return
  assert.deepEqual(out[0].children.map(c => c.id).sort(), ['p1', 'p2'])
})

test('bridge rows are never emitted — only what sold is rendered', () => {
  const out = groupByVariant(SOLD, ALL_LISTINGS)
  const ids = out.flatMap(i => i.type === 'parent' ? i.children.map(c => c.id) : [i.row.id])
  assert.deepEqual(ids.sort(), ['p1', 'p2'])
  // p3/p4 exist only to link; putting them on screen would invent sales.
  assert.ok(!ids.includes('p3') && !ids.includes('p4'))
})

test('bridge rows do not push a lone sold listing over the ≥2 parent threshold', () => {
  // Only the black Uzum listing sold. Three siblings link to it, but a parent
  // wrapping one child is a chevron that hides nothing.
  const out = groupByVariant([row('p1', 'JMBLK', 'uzum:M9')], ALL_LISTINGS)
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'flat')
})

test('unrelated products stay apart when bridged', () => {
  const sold = [row('a1', 'JMBLK', 'uzum:M9'), row('b1', 'JMJ16BG', 'uzum:J16')]
  const out = groupByVariant(sold, [...ALL_LISTINGS, row('b2', 'JMJ16BG', 'yandex:J16')])
  assert.equal(out.length, 2)
  assert.ok(out.every(i => i.type === 'flat'))
})

test('omitting the bridge leaves existing callers byte-identical', () => {
  const rows = [
    row('x1', 'AAA', 'uzum:X'),
    row('x2', 'BBB', 'uzum:X'),
    row('y1', 'CCC', null),
  ]
  assert.deepEqual(groupByVariant(rows), groupByVariant(rows, []))
})

// A NULL group key means "never group" — the orphan/'Удалённый товар' rule.
// The bridge must not give such a row a way in through a shared SKU.
test('a null-key row stays flat even when a bridge row shares its SKU', () => {
  const out = groupByVariant(
    [row('o1', 'JMBLK', null), row('p1', 'JMBLK', 'uzum:M9')],
    ALL_LISTINGS,
  )
  const orphan = out.find(i => i.type === 'flat' && i.row.id === 'o1')
  assert.ok(orphan, 'orphan row must render flat, never absorbed into a parent')
})
