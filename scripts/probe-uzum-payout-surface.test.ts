/**
 * The classifier is the safety-critical part of the payout probe: it decides
 * which POST operations get put in front of the owner as "candidate for the
 * allowlist". A false "read" on a mutating endpoint is the one failure that
 * matters, so the bias is asymmetric — anything not clearly a read must come
 * back write or unclear, never read.
 *
 * Run: node --import tsx --test scripts/probe-uzum-payout-surface.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyPost } from './probe-uzum-payout-surface'

const v = (op: unknown) => classifyPost(op).verdict

describe('classifyPost — never green-light a mutation', () => {
  it('calls a payout-creating operation a write', () => {
    assert.equal(v({ operationId: 'createPayout', summary: 'Create a payout' }), 'write')
    assert.equal(v({ operationId: 'requestWithdrawal' }), 'write')
    assert.equal(v({ summary: 'Initiate payment to seller' }), 'write')
    assert.equal(v({ operationId: 'submitPaymentOrder' }), 'write')
  })

  it('calls a listing operation a read', () => {
    assert.equal(v({ operationId: 'getPaymentsList', summary: 'List payments' }), 'read')
    assert.equal(v({ operationId: 'searchOperations' }), 'read')
    assert.equal(v({ summary: 'Payout history for the period' }), 'read')
  })

  it('refuses to guess when the spec says nothing', () => {
    assert.equal(v({}), 'unclear')
    assert.equal(v(null), 'unclear')
    assert.equal(v({ operationId: '', summary: '   ' }), 'unclear')
    assert.equal(v({ operationId: 'paymentsEndpoint' }), 'unclear')
  })

  it('resolves a mixed read+write description as a write', () => {
    // "Get or create" must not be read — the create half is what would fire.
    assert.equal(v({ operationId: 'getOrCreatePayout', summary: 'Fetch or create' }), 'write')
  })

  it('reads the path name for nothing — only the spec text decides', () => {
    // The whole reason /v1/finance/payments is ambiguous: its NAME is no evidence.
    assert.equal(v({ operationId: 'createPayment' }), 'write')
    assert.equal(v({ operationId: 'getPayment' }), 'read')
  })
})
