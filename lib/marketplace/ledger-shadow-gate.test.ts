// Regression guard for the flag that kept the evaluator dark: it MUST be read at
// runtime, not frozen at module load / folded at build. Proof = a change to
// process.env made AFTER import is reflected by the function.
//   node --import tsx --test lib/marketplace/ledger-shadow-gate.test.ts
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ledgerShadowEnabled } from './ledger-shadow'

const orig = process.env.LEDGER_SHADOW_ENABLED
afterEach(() => {
  if (orig === undefined) delete process.env.LEDGER_SHADOW_ENABLED
  else process.env.LEDGER_SHADOW_ENABLED = orig
})

describe('ledgerShadowEnabled — runtime read, not a build-time constant', () => {
  it('is false when unset', () => {
    delete process.env.LEDGER_SHADOW_ENABLED
    assert.equal(ledgerShadowEnabled(), false)
  })
  it('reflects a value set AFTER import (proves it is evaluated at call time)', () => {
    process.env.LEDGER_SHADOW_ENABLED = 'true'
    assert.equal(ledgerShadowEnabled(), true)   // a module-scope const would still be false here
  })
  it('accepts the usual truthy spellings, rejects the rest', () => {
    for (const on of ['true', '1', 'on', 'yes', 'TRUE', ' Yes ']) {
      process.env.LEDGER_SHADOW_ENABLED = on
      assert.equal(ledgerShadowEnabled(), true, `expected on for ${JSON.stringify(on)}`)
    }
    for (const off of ['false', '0', '', 'off', 'no', 'enabled?']) {
      process.env.LEDGER_SHADOW_ENABLED = off
      assert.equal(ledgerShadowEnabled(), false, `expected off for ${JSON.stringify(off)}`)
    }
  })
})
