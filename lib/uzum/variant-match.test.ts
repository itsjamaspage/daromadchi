/**
 * Variant-safe order-item → product matching.
 * Run: node --import tsx --test lib/uzum/variant-match.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickByColor, buildVariantIndex, resolveVariant,
  type ProductCandidate, type IndexedProduct,
} from './variant-match'
import { canonicalSkuCandidates, LEGACY_SKU_ALIASES } from '@/lib/products/sku-aliases'

const JMBLK: ProductCandidate = { id: 'id-jmblk', color: 'black' }
const JMWHT: ProductCandidate = { id: 'id-jmwht', color: 'white' }

describe('pickByColor', () => {
  it('the real case: a black line does not resolve to the white product', () => {
    assert.equal(pickByColor([JMBLK, JMWHT], 'black'), 'id-jmblk')
    assert.equal(pickByColor([JMBLK, JMWHT], 'white'), 'id-jmwht')
  })

  it('an unambiguous key resolves without a colour', () => {
    // Single-variant products must not be orphaned by demanding a tie-break.
    assert.equal(pickByColor([JMWHT], null), 'id-jmwht')
    assert.equal(pickByColor([JMWHT], 'black'), 'id-jmwht')
  })

  it('refuses to guess when the colour cannot decide', () => {
    assert.equal(pickByColor([JMBLK, JMWHT], null), undefined,       'no item colour')
    assert.equal(pickByColor([JMBLK, JMWHT], 'red'), undefined,      'colour matches neither')
    assert.equal(pickByColor([JMBLK, { id: 'x', color: 'black' }], 'black'), undefined, 'two same-colour candidates')
    assert.equal(pickByColor([], 'black'), undefined)
    assert.equal(pickByColor(undefined, 'black'), undefined)
  })

  it('never returns a candidate whose colour contradicts the item', () => {
    // The invariant that matters: whatever comes back, it is not the wrong colour.
    for (const color of ['black', 'white', 'red', null] as const) {
      const got = pickByColor([JMBLK, JMWHT], color)
      if (got === undefined) continue
      const chosen = [JMBLK, JMWHT].find(c => c.id === got)!
      assert.equal(chosen.color, color, `resolved to ${chosen.color} for a ${color} item`)
    }
  })
})

describe('canonicalSkuCandidates — colour variants must not collapse', () => {
  it('the two JMM99 colours no longer produce the same candidate', () => {
    const black = canonicalSkuCandidates('5124786-JMM99-ЧЕРН')
    const white = canonicalSkuCandidates('5124786-JMM99-БЕЛ')
    // Before the fix both contained 'JMWHT', so the black order linked to white.
    assert.ok(!black.includes('JMWHT'), `black candidates still name the white product: ${black.join(', ')}`)
    assert.ok(!white.includes('JMBLK'), `white candidates name the black product: ${white.join(', ')}`)
  })

  it('a genuine variant rename still re-links', () => {
    // JMJ16BEG → JMJ16BG is ONE variant renamed, which is what aliases are for.
    assert.ok(canonicalSkuCandidates('5124786-JMJ16BEG').includes('JMJ16BG'))
  })

  it('JMM99 is not aliased — it is a base article, not a renamed variant', () => {
    // The regression guard. `JMM99: 'JMWHT'` is what linked every black watch to
    // the white product. It cannot be caught structurally: canonicalSkuCandidates
    // strips the colour suffix to build `core`, so EVERY alias applies across all
    // colours of its key. That is fine for a renamed variant article
    // (JMJ16BEG → JMJ16BG) and catastrophic for a base article shared by several
    // colours — and only the data says which a key is. So it is named here.
    assert.equal(LEGACY_SKU_ALIASES['JMM99'], undefined,
      'JMM99 is the base article of JMM99-ЧЕРН and JMM99-БЕЛ. Aliasing it to one ' +
      'variant makes every colour resolve to that variant. Let pickByColor decide.')
  })

  it('every alias stays inside its own article family', () => {
    // A rename keeps the family (JMJ16BEG → JMJ16BG). A key and value with
    // nothing in common is a remap to a DIFFERENT product, which is what an
    // alias must never be — that was JMM99 → JMWHT.
    for (const [key, value] of Object.entries(LEGACY_SKU_ALIASES)) {
      let shared = 0
      while (shared < Math.min(key.length, value.length) && key[shared] === value[shared]) shared++
      assert.ok(shared >= 4,
        `alias ${key} → ${value} shares only "${key.slice(0, shared)}" — that is a remap ` +
        'to another product, not a rename of the same one.')
    }
  })
})

/* ── The audit bug: colour as a search key vs colour as a tie-break ──────────
 *
 * The shop that hit this in production, as far as matching is concerned: two
 * colour variants of one watch (sharing a title), plus an unrelated black
 * powerbank. The first audit script matched on colour alone within the shop, so
 * a black watch line offered BOTH black products and the "correct product"
 * column named whichever came back first.
 */
const SHOP: IndexedProduct[] = [
  { id: 'id-jmblk', sku: 'JMBLK', title: 'Смарт-часы M9',   color: 'black' },
  { id: 'id-jmwht', sku: 'JMWHT', title: 'Смарт-часы M9',   color: 'white' },
  { id: 'id-pbblk', sku: 'PBBLK', title: 'Повербанк 20000', color: 'black' },
]

describe('resolveVariant — identity first, colour only as the tie-break', () => {
  const index = buildVariantIndex(SHOP)

  it('the production line resolves to the black WATCH, never the black powerbank', () => {
    // order_items row of 124459482: sku is the skuTitle, title is the product
    // title shared by both colours. The article never matches products.sku
    // ("JMM99-ЧЕРН" vs "JMBLK"), so it lands on the title step — exactly where
    // the original mislink happened — and the colour picks within that family.
    const got = resolveVariant(index, {
      skus: ['5124786-JMM99-ЧЕРН'],
      title: 'Смарт-часы M9',
      color: 'black',
    })
    assert.equal(got, 'id-jmblk')
  })

  it('no black item of any shape can resolve to the powerbank', () => {
    // The invariant the cleanup UPDATE depends on. A powerbank shares no
    // article, barcode or title with a watch, so it is never a candidate —
    // whatever colour the line carries.
    for (const title of ['Смарт-часы M9', null]) {
      for (const sku of ['5124786-JMM99-ЧЕРН', '5124786-JMM99-БЕЛ', 'JMBLK', null]) {
        const got = resolveVariant(index, { skus: [sku], title, color: 'black' })
        assert.notEqual(got, 'id-pbblk', `sku=${sku} title=${title} resolved to the powerbank`)
      }
    }
  })

  it('each colour resolves to its own product — one answer, not a list', () => {
    assert.equal(resolveVariant(index, { skus: ['5124786-JMM99-БЕЛ'], title: 'Смарт-часы M9', color: 'white' }), 'id-jmwht')
    assert.equal(resolveVariant(index, { skus: ['5124786-JMM99-ЧЕРН'], title: 'Смарт-часы M9', color: 'black' }), 'id-jmblk')
  })

  it('an exact article beats the shared title', () => {
    assert.equal(resolveVariant(index, { skus: ['JMBLK'], title: 'Смарт-часы M9', color: null }), 'id-jmblk')
  })

  it('the marketplace variant id wins outright — it is already variant-specific', () => {
    const withIds = buildVariantIndex([
      { id: 'id-jmblk', sku: 'JMBLK', title: 'Смарт-часы M9', marketplaceProductId: 111, color: 'black' },
      { id: 'id-jmwht', sku: 'JMWHT', title: 'Смарт-часы M9', marketplaceProductId: 222, color: 'white' },
    ])
    assert.equal(resolveVariant(withIds, { marketplaceProductId: '222', color: null }), 'id-jmwht')
  })

  it('returns null rather than a guess when the colour cannot decide', () => {
    assert.equal(resolveVariant(index, { skus: [null], title: 'Смарт-часы M9', color: null }), null)
    assert.equal(resolveVariant(index, { skus: ['UNKNOWN'], title: 'Нет такого', color: 'black' }), null)
  })

  it('a single-product shop still links without any colour evidence', () => {
    const solo = buildVariantIndex([{ id: 'only', sku: 'X', title: 'T', color: null }])
    assert.equal(resolveVariant(solo, { skus: ['whatever'], title: 'nothing', color: null }), 'only')
  })

  it('a sku that is just the marketplace id is not indexed as an article', () => {
    // The order-stub path writes sku = String(skuId). Indexing that as a seller
    // article invents matches between unrelated products.
    const stubs = buildVariantIndex([
      { id: 'a', sku: '5124786', marketplaceProductId: 5124786, title: 'A', color: 'black' },
      { id: 'b', sku: '5124787', marketplaceProductId: 5124787, title: 'B', color: 'black' },
    ])
    assert.equal(stubs.bySku.size, 0)
    assert.equal(resolveVariant(stubs, { marketplaceProductId: 5124787, color: 'black' }), 'b')
  })
})
