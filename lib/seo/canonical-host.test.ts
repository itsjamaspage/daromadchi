// Proves the www→apex canonical-host redirect without ever touching production.
// Run: node --import tsx --test lib/seo/canonical-host.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { wwwToApexRedirect } from './canonical-host'

describe('www→apex canonical-host redirect', () => {
  it('www PAGE request → single 301 target on the apex, SAME path + query, https', () => {
    const r = wwwToApexRedirect('www.daromadchi.uz', new URL('http://www.daromadchi.uz/pricing?ref=x'))
    assert.ok(r, 'should redirect')
    assert.equal(r!.protocol, 'https:')
    assert.equal(r!.host, 'daromadchi.uz')
    assert.equal(r!.pathname, '/pricing')      // same path
    assert.equal(r!.search, '?ref=x')          // query preserved
    assert.equal(r!.href, 'https://daromadchi.uz/pricing?ref=x')
  })

  it('nested path keeps the full path', () => {
    const r = wwwToApexRedirect('www.daromadchi.uz', new URL('https://www.daromadchi.uz/help/how-to'))
    assert.equal(r!.href, 'https://daromadchi.uz/help/how-to')
  })

  it('already-apex request → NO redirect (loop-safe)', () => {
    assert.equal(wwwToApexRedirect('daromadchi.uz', new URL('https://daromadchi.uz/pricing')), null)
  })

  it('/api/ on the www host → NO redirect (POST body never turned into a GET)', () => {
    assert.equal(wwwToApexRedirect('www.daromadchi.uz', new URL('https://www.daromadchi.uz/api/health')), null)
    assert.equal(wwwToApexRedirect('www.daromadchi.uz', new URL('https://www.daromadchi.uz/api/ext/sync')), null)
  })

  it('host match is case-insensitive, and the destination carries no port', () => {
    const r = wwwToApexRedirect('WWW.DAROMADCHI.UZ', new URL('http://www.daromadchi.uz/'))
    assert.equal(r!.href, 'https://daromadchi.uz/')
  })

  it('a forwarded host carrying a port still matches', () => {
    // x-forwarded-host arrives as `www.daromadchi.uz:443` behind some proxies.
    // Comparing that to the bare host would skip the redirect entirely.
    const r = wwwToApexRedirect('www.daromadchi.uz:443', new URL('https://www.daromadchi.uz/about'))
    assert.equal(r!.href, 'https://daromadchi.uz/about')
  })

  it('other hosts pass through (localhost, other subdomains, missing host)', () => {
    assert.equal(wwwToApexRedirect('localhost:3000', new URL('http://localhost:3000/pricing')), null)
    assert.equal(wwwToApexRedirect(null, new URL('https://www.daromadchi.uz/pricing')), null)
    assert.equal(wwwToApexRedirect('sub.daromadchi.uz', new URL('https://sub.daromadchi.uz/')), null)
  })

  it('the redirect target is the host the sitemap and metadataBase declare', () => {
    // The bug this reversal fixes: middleware and canonicals disagreeing sends
    // crawlers away from every URL the site publishes. Pin them together.
    const r = wwwToApexRedirect('www.daromadchi.uz', new URL('https://www.daromadchi.uz/'))
    assert.equal(r!.origin, 'https://daromadchi.uz')
  })
})
