// SKU alias / prefix-strip candidates used by order↔product re-linking.
// Run: node --import tsx --test lib/products/sku-aliases.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalSkuCandidates } from './sku-aliases'

describe('canonicalSkuCandidates', () => {
  it('maps a prefixed legacy article to the current one, alias first', () => {
    // The confirmed re-orphan case: incoming "5124786-JMJ16BEG" must reach JMJ16BG.
    const c = canonicalSkuCandidates('5124786-JMJ16BEG')
    assert.equal(c[0], 'JMJ16BG')              // renamed product, tried first
    assert.ok(c.includes('JMJ16BEG'))          // prefix-stripped legacy also offered
  })

  it('does NOT resolve a colour variant through its base article', () => {
    // This case used to assert the opposite — that "5124786-JMM99-БЕЛЫЙ" maps to
    // JMWHT via the core JMM99. It passed, and it hid a live data bug: the test
    // only ever tried the WHITE variant, where mapping the shared base article to
    // the white product happens to give the right answer. The black variant,
    // "5124786-JMM99-ЧЕРН", took the same path to the same place and linked
    // black-watch orders to the white product.
    //
    // A base article cannot decide a colour. Both variants now fall through to
    // the matcher, where variant_color picks — see lib/uzum/variant-match.ts.
    for (const raw of ['5124786-JMM99-БЕЛЫЙ', '5124786-JMM99-ЧЕРН']) {
      const c = canonicalSkuCandidates(raw)
      assert.ok(!c.includes('JMWHT'), `${raw} still resolves to JMWHT: ${c.join(', ')}`)
      assert.ok(c.includes('JMM99'), 'the bare core is still offered as a lookup key')
    }
  })

  it('leaves a current article unchanged (exact match still works)', () => {
    assert.deepEqual(canonicalSkuCandidates('JMWHT'), ['JMWHT'])
  })

  it('strips the numeric prefix even without an alias', () => {
    const c = canonicalSkuCandidates('9990001-JMABC')
    assert.ok(c.includes('JMABC'))
  })

  it('returns [] for empty / nullish input', () => {
    assert.deepEqual(canonicalSkuCandidates(''), [])
    assert.deepEqual(canonicalSkuCandidates(null), [])
    assert.deepEqual(canonicalSkuCandidates(undefined), [])
  })
})
