import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stockKeysFor, trimmedIndex, resolveStock } from './stock-key-match'

// The reported gap: the light refresh looked up products.sku and nothing else,
// so a row stored with a marketSku (offer-mappings returned no shopSku) could
// never match, and its stock moved only on the plan-gated heavy pass.

test('the reported gap: a row keyed by marketSku now resolves', () => {
  // sku is the numeric marketSku; the response is keyed by the real offerId,
  // which we hold in market_sku. Old code: miss. New code: hit.
  const p = { sku: '101922344', market_sku: 'JMJ16WH', marketplace_product_id: '101922344' }
  const map = new Map([['JMJ16WH', 7]])
  assert.equal(resolveStock(p, map, trimmedIndex(map)), 7)
})

test('the ordinary case still resolves on sku alone', () => {
  const map = new Map([['KBBLK', 3]])
  assert.equal(resolveStock({ sku: 'KBBLK' }, map, trimmedIndex(map)), 3)
})

test('marketplace_product_id is the last resort, and it works', () => {
  const map = new Map([['555', 2]])
  assert.equal(resolveStock({ sku: null, market_sku: null, marketplace_product_id: '555' }, map), 2)
})

// ── Absence is UNKNOWN, never zero ──────────────────────────────────────────
// This is the module's one rule. Widening what we can FIND must never widen
// what we are willing to WRITE.

test('no identifier matches → undefined, not 0', () => {
  const map = new Map([['OTHER', 5]])
  assert.equal(resolveStock({ sku: 'KBBLK', market_sku: 'KBBLK' }, map), undefined)
})

test('a row with no identifiers at all → undefined', () => {
  assert.equal(resolveStock({ sku: null, market_sku: null, marketplace_product_id: null }, new Map([['X', 1]])), undefined)
  assert.equal(resolveStock({ sku: '   ' }, new Map([['X', 1]])), undefined)
})

test('a reported zero is returned as 0, and is distinct from undefined', () => {
  // "sold out" is real information; conflating it with "unknown" is the bug
  // yandex/client.ts:632-639 documents. resolveStock must not re-introduce it.
  const map = new Map([['KBBLK', 0]])
  const got = resolveStock({ sku: 'KBBLK' }, map)
  assert.equal(got, 0)
  assert.notEqual(got, undefined)
})

test('an empty map matches nothing', () => {
  assert.equal(resolveStock({ sku: 'KBBLK', market_sku: 'KBBLK' }, new Map()), undefined)
})

// ── Precedence ──────────────────────────────────────────────────────────────

test('market_sku wins over sku — it is the identifier sourced from this API', () => {
  const map = new Map([['A', 1], ['B', 2]])
  assert.equal(resolveStock({ sku: 'B', market_sku: 'A' }, map), 1)
})

test('an exact match on a later key beats a trimmed match on an earlier one', () => {
  // market_sku only matches after trimming; sku matches exactly. Exact wins,
  // because pass 1 runs over every key before pass 2 starts.
  const map = new Map([[' A ', 1], ['B', 2]])
  assert.equal(resolveStock({ sku: 'B', market_sku: 'A' }, map, trimmedIndex(map)), 2)
})

// ── Whitespace tolerance ────────────────────────────────────────────────────
// Three order-derived paths write products.sku untrimmed (yandex/sync.ts:759,
// :829, :1007) while skuOf() trims. Same product, two spellings.

test('a stored SKU with stray whitespace matches a clean response key', () => {
  const map = new Map([['KBBLK', 4]])
  assert.equal(resolveStock({ sku: ' KBBLK ' }, map, trimmedIndex(map)), 4)
})

test('a response key with stray whitespace matches a clean stored SKU', () => {
  const map = new Map([[' KBBLK ', 4]])
  assert.equal(resolveStock({ sku: 'KBBLK' }, map, trimmedIndex(map)), 4)
})

test('without the trimmed index there is no fuzzy matching at all', () => {
  const map = new Map([[' KBBLK ', 4]])
  assert.equal(resolveStock({ sku: 'KBBLK' }, map), undefined)
})

test('trimming is not case folding — SKUs stay case-sensitive', () => {
  // products.sku is uppercase, stock_sync_state.sku is lowercase, and it would
  // be easy to "fix" that here. Casing is a real distinction on the wire; only
  // whitespace is treated as noise.
  const map = new Map([['kbblk', 4]])
  assert.equal(resolveStock({ sku: 'KBBLK' }, map, trimmedIndex(map)), undefined)
})

test('two raw keys trimming to the same string: first wins, no arbitrary swap', () => {
  const map = new Map([[' A ', 1], ['A  ', 2]])
  assert.equal(trimmedIndex(map).get('A'), 1)
})

test('exact keys are not duplicated into the trimmed index', () => {
  const map = new Map([['A', 1], [' B ', 2]])
  const idx = trimmedIndex(map)
  assert.equal(idx.has('A'), false)   // exact lookup already covers it
  assert.equal(idx.get('B'), 2)
})

// ── The request list ────────────────────────────────────────────────────────

test('stockKeysFor returns every identifier, trimmed, deduped, in trust order', () => {
  assert.deepEqual(
    stockKeysFor({ sku: ' B ', market_sku: 'A', marketplace_product_id: 'C' }),
    ['A', 'B', 'C'],
  )
})

test('stockKeysFor collapses identical identifiers to one', () => {
  assert.deepEqual(stockKeysFor({ sku: 'A', market_sku: 'A', marketplace_product_id: 'A' }), ['A'])
})

test('stockKeysFor drops empty and whitespace-only identifiers', () => {
  assert.deepEqual(stockKeysFor({ sku: '', market_sku: null, marketplace_product_id: '  ' }), [])
})
