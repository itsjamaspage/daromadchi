/**
 * The backfill's decision rule, without a database.
 * Run: node --import tsx --test scripts/backfill-variant-color.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from './backfill-variant-color'

const row = (over: Partial<Parameters<typeof decide>[0]> = {}) => ({
  id: 'p1', shop_id: 's1', marketplace: 'uzum', sku: 'JMBLK',
  title: 'Смарт-часы M9', line_colors: [], title_siblings: 1, sibling_colors: [],
  ...over,
})

describe('backfill decision', () => {
  it('reads the colour out of the title, like the catalogue path does', () => {
    assert.deepEqual(decide(row({ title: 'Смарт-часы M9 Чёрный' })), { fill: 'black', source: 'title' })
  })

  it('falls back to the order lines when they are unanimous', () => {
    assert.deepEqual(decide(row({ line_colors: ['black'] })), { fill: 'black', source: 'order lines' })
  })

  it('refuses a split vote — that is a mislink, not a missing colour', () => {
    const v = decide(row({ line_colors: ['black', 'white'] }))
    assert.equal(v.fill, null)
    assert.match('reason' in v ? v.reason : '', /disagree/)
  })

  it('refuses when the title and the lines contradict each other', () => {
    const v = decide(row({ title: 'Смарт-часы M9 Белый', line_colors: ['black'] }))
    assert.equal(v.fill, null)
    assert.match('reason' in v ? v.reason : '', /mislink/)
  })

  it('never gives a product the colour a same-title sibling already has', () => {
    // Two same-colour siblings is the one state pickByColor cannot resolve;
    // writing it would orphan every future order for that pair.
    const v = decide(row({ line_colors: ['black'], title_siblings: 2, sibling_colors: ['black'] }))
    assert.equal(v.fill, null)
    assert.match('reason' in v ? v.reason : '', /already black/)
  })

  it('fills happily when the sibling holds the OTHER colour', () => {
    assert.deepEqual(
      decide(row({ line_colors: ['black'], title_siblings: 2, sibling_colors: ['white'] })),
      { fill: 'black', source: 'order lines' },
    )
  })

  it('leaves a genuinely uncoloured product alone', () => {
    // The J16 earphones: no colour word, no coloured line. NULL is the truth.
    const v = decide(row({ title: 'Наушники J16', sku: 'J16' }))
    assert.equal(v.fill, null)
  })

  it('a stub titled "SKU 5124786" yields nothing from its title', () => {
    // The order-stub fallback title. It carries no colour, which is why these
    // rows were the blind spot in the first place — the lines decide, or nothing.
    assert.equal(decide(row({ title: 'SKU 5124786', sku: '5124786' })).fill, null)
    assert.deepEqual(
      decide(row({ title: 'SKU 5124786', sku: '5124786', line_colors: ['white'] })),
      { fill: 'white', source: 'order lines' },
    )
  })
})
