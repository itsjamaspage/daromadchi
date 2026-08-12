// Pure tests for ATMOS callback sign generation/verification.
// Run: node --import tsx --test lib/atmos/sign.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'crypto'
import { buildSignPayload, computeSign, verifySign, ATMOS_SIGN_ALGO, type SignParts } from './sign'

const parts: SignParts = {
  storeId: '1234',
  transactionId: '987654',
  account: 'abc-account',
  amount: 25_200_000,
  apiKey: 'secret_api_key',
}

describe('buildSignPayload', () => {
  it('concatenates store_id+transaction_id+account+amount+api_key with NO separators', () => {
    assert.equal(buildSignPayload(parts), '1234987654abc-account25200000secret_api_key')
  })
})

describe('computeSign', () => {
  it('matches a hand-computed hash of the exact payload (known vector)', () => {
    const expected = createHash(ATMOS_SIGN_ALGO)
      .update('1234987654abc-account25200000secret_api_key', 'utf8')
      .digest('hex')
    assert.equal(computeSign(parts), expected)
    assert.equal(computeSign(parts).length, 32) // md5 hex
  })
})

describe('verifySign', () => {
  it('accepts the correct sign (case-insensitive)', () => {
    const good = computeSign(parts)
    assert.equal(verifySign(good, parts), true)
    assert.equal(verifySign(good.toUpperCase(), parts), true)
  })
  it('rejects a wrong sign, empty sign, and a length mismatch', () => {
    assert.equal(verifySign('00000000000000000000000000000000', parts), false)
    assert.equal(verifySign('', parts), false)
    assert.equal(verifySign('abc', parts), false)
  })
  it('rejects when any signed field changes (amount tamper)', () => {
    const good = computeSign(parts)
    assert.equal(verifySign(good, { ...parts, amount: 25_200_001 }), false)
    assert.equal(verifySign(good, { ...parts, account: 'other' }), false)
  })
})
