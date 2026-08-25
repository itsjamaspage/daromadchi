import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANALYTICS_COLUMNS, COLUMN_KEYS, COLUMN_PRESETS,
  hiddenForPreset, normalizeHidden, isVisible, visibleCount,
} from './analytics-columns'

// ── The product column can never be hidden ──────────────────────────────────
// Without it the table is a grid of numbers with no subject.

test('the product column is locked on, whatever the stored preference says', () => {
  assert.equal(isVisible('product', ['product', 'margin']), true)
})

test('a hand-edited or corrupted preference cannot hide it', () => {
  assert.deepEqual(normalizeHidden(['product']), [], 'locked keys are stripped')
})

test('no preset can turn it off', () => {
  for (const name of Object.keys(COLUMN_PRESETS)) {
    assert.equal(hiddenForPreset(name).includes('product'), false, name)
  }
})

// ── Hidden, not visible — the load-bearing storage choice ───────────────────

test('a column the stored preference has never heard of is shown', () => {
  // This is why the HIDDEN set is stored. If we stored the visible set, every
  // column added in a later release would be missing from existing sellers'
  // saved lists and would silently never appear for them.
  const savedBeforeAbcExisted = ['cancelled']
  assert.equal(isVisible('abc', savedBeforeAbcExisted), true)
})

test('an unknown key in stored preferences is dropped, not kept', () => {
  // A column removed from the app should not occupy saved state forever.
  assert.deepEqual(normalizeHidden(['margin', 'someColumnWeDeleted']), ['margin'])
})

test('junk input degrades to "nothing hidden" rather than throwing', () => {
  for (const junk of [null, undefined, 'margin', 42, {}, [1, 2, 3]]) {
    assert.deepEqual(normalizeHidden(junk), [], String(junk))
  }
})

test('duplicates collapse', () => {
  assert.deepEqual(normalizeHidden(['margin', 'margin']), ['margin'])
})

// ── Presets ────────────────────────────────────────────────────────────────

test('every preset names only real columns', () => {
  for (const [name, keys] of Object.entries(COLUMN_PRESETS)) {
    for (const k of keys) assert.ok(COLUMN_KEYS.includes(k), `${name} → ${k}`)
  }
})

test('"all" hides nothing', () => {
  assert.deepEqual(hiddenForPreset('all'), [])
  assert.equal(visibleCount(hiddenForPreset('all')), COLUMN_KEYS.length)
})

test('"minimal" leaves the four that answer "did it sell and does it earn"', () => {
  const hidden = hiddenForPreset('minimal')
  for (const on of ['product', 'delivered', 'revenue', 'margin']) {
    assert.equal(isVisible(on, hidden), true, on)
  }
  assert.equal(isVisible('returnRate', hidden), false)
  assert.equal(visibleCount(hidden), 4)
})

test('an unknown preset name shows everything rather than hiding everything', () => {
  // Failing toward MORE data: a typo must not blank the table.
  assert.deepEqual(hiddenForPreset('nonsense'), [])
})

// ── The registry itself ────────────────────────────────────────────────────

test('keys are unique — a duplicate would render one column twice', () => {
  assert.equal(new Set(COLUMN_KEYS).size, COLUMN_KEYS.length)
})

test('exactly one column is locked', () => {
  assert.deepEqual(ANALYTICS_COLUMNS.filter(c => c.locked).map(c => c.key), ['product'])
})

test('every column carries a label key, so none can render headerless', () => {
  for (const c of ANALYTICS_COLUMNS) {
    assert.ok(c.labelKey && c.labelKey.length > 0, c.key)
  }
})

test('hiding everything hideable still leaves the product column', () => {
  const hidden = COLUMN_KEYS.filter(k => k !== 'product')
  assert.equal(visibleCount(hidden), 1)
  assert.equal(isVisible('product', hidden), true)
})
