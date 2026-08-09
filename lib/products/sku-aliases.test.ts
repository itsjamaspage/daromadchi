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

  it('maps a prefixed legacy article with a colour suffix via its core', () => {
    const c = canonicalSkuCandidates('5124786-JMM99-БЕЛЫЙ')
    assert.ok(c.includes('JMWHT'))             // core JMM99 → JMWHT
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
