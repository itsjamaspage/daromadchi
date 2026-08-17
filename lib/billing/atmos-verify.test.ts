import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  atmosCallbackSignPayload, computeCallbackSign, verifyCallbackSign,
  ipInCidr, ipInAnyCidr, clientIpFromForwarded,
} from './atmos-verify'

const parts = {
  storeId: '11054',
  transactionId: 'TX-123',
  account: 'acc-abc',
  amount: 5000000,        // 50 000 UZS in tiyin
  apiKey: 'super-secret-callback-key',
}

test('sign payload concatenates fields in order with NO separators', () => {
  assert.equal(atmosCallbackSignPayload(parts), '11054TX-123acc-abc5000000super-secret-callback-key')
})

test('computeCallbackSign is md5 of the payload', () => {
  const expected = createHash('md5').update(atmosCallbackSignPayload(parts), 'utf8').digest('hex')
  assert.equal(computeCallbackSign(parts), expected)
})

test('verifyCallbackSign accepts the correct sign', () => {
  assert.equal(verifyCallbackSign(computeCallbackSign(parts), parts), true)
})

test('verifyCallbackSign is case-insensitive on the hex', () => {
  assert.equal(verifyCallbackSign(computeCallbackSign(parts).toUpperCase(), parts), true)
})

test('verifyCallbackSign rejects a wrong api key', () => {
  const forged = computeCallbackSign({ ...parts, apiKey: 'wrong-key' })
  assert.equal(verifyCallbackSign(forged, parts), false)
})

test('verifyCallbackSign rejects a tampered amount', () => {
  const good = computeCallbackSign(parts)
  assert.equal(verifyCallbackSign(good, { ...parts, amount: 1 }), false)
})

test('verifyCallbackSign fails closed on empty / non-string / short', () => {
  assert.equal(verifyCallbackSign('', parts), false)
  assert.equal(verifyCallbackSign(undefined, parts), false)
  assert.equal(verifyCallbackSign('abc', parts), false)
})

test('amount is bound byte-exactly: tiyin vs so\'m produce different signs', () => {
  const tiyinSign = computeCallbackSign(parts)                 // amount 5000000
  const somSign   = computeCallbackSign({ ...parts, amount: 50000 })
  assert.notEqual(tiyinSign, somSign)
})

test('ipInCidr matches inside /24 and rejects outside', () => {
  assert.equal(ipInCidr('92.63.207.1', '92.63.207.0/24'), true)
  assert.equal(ipInCidr('92.63.207.255', '92.63.207.0/24'), true)
  assert.equal(ipInCidr('92.63.208.1', '92.63.207.0/24'), false)
  assert.equal(ipInCidr('10.0.0.1', '92.63.207.0/24'), false)
  assert.equal(ipInCidr('not-an-ip', '92.63.207.0/24'), false)
})

test('ipInAnyCidr matches the real ATMOS ranges and rejects outside', () => {
  const ranges = '152.233.12.0/23,92.63.207.0/24'
  // CDN77-Amsterdam pool (real production callbacks — address varies per payment)
  assert.equal(ipInAnyCidr('152.233.12.242', ranges), true)
  assert.equal(ipInAnyCidr('152.233.13.245', ranges), true)  // /23 spans .12 and .13
  // documented range still allowed
  assert.equal(ipInAnyCidr('92.63.207.10', ranges), true)
  // outside both
  assert.equal(ipInAnyCidr('152.233.14.1', ranges), false)
  assert.equal(ipInAnyCidr('10.0.0.1', ranges), false)
})

test('ipInAnyCidr tolerates spaces/semicolons and blank lists', () => {
  assert.equal(ipInAnyCidr('92.63.207.1', '152.233.12.0/23 ; 92.63.207.0/24'), true)
  assert.equal(ipInAnyCidr('92.63.207.1', ''), false)        // fail closed
  assert.equal(ipInAnyCidr('not-an-ip', '92.63.207.0/24'), false)
})

test('clientIpFromForwarded takes the leftmost XFF entry, else fallback', () => {
  assert.equal(clientIpFromForwarded('92.63.207.5, 10.0.0.1', '10.0.0.9'), '92.63.207.5')
  assert.equal(clientIpFromForwarded(null, '10.0.0.9'), '10.0.0.9')
  assert.equal(clientIpFromForwarded(undefined, null), null)
})
