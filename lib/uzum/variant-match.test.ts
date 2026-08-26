/**
 * Variant-safe order-item → product matching.
 * Run: node --import tsx --test lib/uzum/variant-match.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickByColor, type ProductCandidate } from './variant-match'
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
