// Pure tests for the ATMOS callback IP allowlist + forwarded-IP extraction.
// Run: node --import tsx --test lib/atmos/net.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ipv4ToInt, ipInCidr, clientIpFromForwarded } from './net'

const ATMOS_CIDR = '92.63.207.0/24'

describe('ipInCidr — ATMOS allowlist 92.63.207.0/24', () => {
  it('accepts addresses inside the /24', () => {
    assert.equal(ipInCidr('92.63.207.1', ATMOS_CIDR), true)
    assert.equal(ipInCidr('92.63.207.255', ATMOS_CIDR), true)
    assert.equal(ipInCidr('92.63.207.42', ATMOS_CIDR), true)
  })
  it('rejects addresses outside the /24', () => {
    assert.equal(ipInCidr('92.63.208.1', ATMOS_CIDR), false)
    assert.equal(ipInCidr('92.63.206.255', ATMOS_CIDR), false)
    assert.equal(ipInCidr('10.0.0.1', ATMOS_CIDR), false)
    assert.equal(ipInCidr('8.8.8.8', ATMOS_CIDR), false)
  })
  it('rejects malformed input', () => {
    assert.equal(ipInCidr('not.an.ip', ATMOS_CIDR), false)
    assert.equal(ipInCidr('92.63.207.256', ATMOS_CIDR), false)
    assert.equal(ipInCidr('92.63.207.1', 'garbage'), false)
  })
  it('ipv4ToInt parses and rejects', () => {
    assert.equal(ipv4ToInt('0.0.0.0'), 0)
    assert.equal(ipv4ToInt('255.255.255.255'), 0xffffffff)
    assert.equal(ipv4ToInt('1.2.3'), null)
    assert.equal(ipv4ToInt('1.2.3.999'), null)
  })
})

describe('clientIpFromForwarded — real client behind the reverse proxy', () => {
  it('takes the LEFTMOST X-Forwarded-For entry (the original client)', () => {
    assert.equal(clientIpFromForwarded('92.63.207.10, 10.0.0.1, 172.16.0.1'), '92.63.207.10')
    assert.equal(clientIpFromForwarded('92.63.207.10'), '92.63.207.10')
  })
  it('falls back when there is no XFF', () => {
    assert.equal(clientIpFromForwarded(null, '92.63.207.5'), '92.63.207.5')
    assert.equal(clientIpFromForwarded(undefined, null), null)
  })
  it('end-to-end: a forwarded ATMOS IP is allowed, a spoof-looking internal is not', () => {
    const ip = clientIpFromForwarded('92.63.207.77, 10.0.0.9')
    assert.equal(ip && ipInCidr(ip, ATMOS_CIDR), true)
    const bad = clientIpFromForwarded('203.0.113.9, 10.0.0.9')
    assert.equal(bad ? ipInCidr(bad, ATMOS_CIDR) : false, false)
  })
})
