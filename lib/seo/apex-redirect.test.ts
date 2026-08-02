// Proves the apex→www canonical-host redirect without ever touching production.
// Run: node --import tsx --test lib/seo/apex-redirect.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { apexToWwwRedirect } from './apex-redirect'

describe('apex→www canonical-host redirect', () => {
  it('apex PAGE request → single 301 target on www, SAME path + query, https', () => {
    const r = apexToWwwRedirect('daromadchi.uz', new URL('http://daromadchi.uz/pricing?ref=x'))
    assert.ok(r, 'should redirect')
    assert.equal(r!.protocol, 'https:')
    assert.equal(r!.host, 'www.daromadchi.uz')
    assert.equal(r!.pathname, '/pricing')      // same path
    assert.equal(r!.search, '?ref=x')          // query preserved
    assert.equal(r!.href, 'https://www.daromadchi.uz/pricing?ref=x')
  })

  it('nested path keeps the full path', () => {
    const r = apexToWwwRedirect('daromadchi.uz', new URL('https://daromadchi.uz/help/how-to'))
    assert.equal(r!.href, 'https://www.daromadchi.uz/help/how-to')
  })

  it('already-www request → NO redirect (loop-safe)', () => {
    assert.equal(apexToWwwRedirect('www.daromadchi.uz', new URL('https://www.daromadchi.uz/pricing')), null)
  })

  it('/api/ on the apex host → NO redirect (POST body never turned into a GET)', () => {
    assert.equal(apexToWwwRedirect('daromadchi.uz', new URL('https://daromadchi.uz/api/health')), null)
    assert.equal(apexToWwwRedirect('daromadchi.uz', new URL('https://daromadchi.uz/api/ext/sync')), null)
  })

  it('host match is case-insensitive and port-agnostic', () => {
    const r = apexToWwwRedirect('DAROMADCHI.UZ', new URL('http://daromadchi.uz/'))
    assert.equal(r!.href, 'https://www.daromadchi.uz/')
  })

  it('other hosts pass through (localhost, www-subpaths, missing host)', () => {
    assert.equal(apexToWwwRedirect('localhost:3000', new URL('http://localhost:3000/pricing')), null)
    assert.equal(apexToWwwRedirect(null, new URL('https://daromadchi.uz/pricing')), null)
    assert.equal(apexToWwwRedirect('sub.daromadchi.uz', new URL('https://sub.daromadchi.uz/')), null)
  })
})
