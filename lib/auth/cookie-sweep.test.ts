import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SESSION_COOKIE_NAMES, domainScopesFor, expiredCookieHeaders } from './cookie-sweep'

// The bug: one cookie NAME can exist twice in a browser at two scopes. Auth.js
// deletes only the scope it is configured with today, so the older host-only
// cookie survives and keeps authenticating.

test('host-only is swept, and it is a distinct scope from the parent domain', () => {
  const scopes = domainScopesFor('www.daromadchi.uz')
  assert.ok(scopes.includes(undefined), 'host-only (no Domain) must be attempted')
  assert.ok(scopes.includes('.daromadchi.uz'), 'the configured parent scope must be attempted')
})

test('every level up to the registrable domain is covered, dotted and undotted', () => {
  const scopes = domainScopesFor('www.daromadchi.uz')
  for (const s of ['www.daromadchi.uz', '.www.daromadchi.uz', 'daromadchi.uz', '.daromadchi.uz']) {
    assert.ok(scopes.includes(s), `missing ${s}`)
  }
})

test('the public suffix is never attempted', () => {
  // No browser accepts Domain=.uz; asking to delete one is meaningless and
  // would be a cross-site request if it were honoured.
  const scopes = domainScopesFor('www.daromadchi.uz')
  assert.equal(scopes.includes('uz'), false)
  assert.equal(scopes.includes('.uz'), false)
})

test('the apex host still sweeps its own parent form', () => {
  const scopes = domainScopesFor('daromadchi.uz')
  assert.ok(scopes.includes(undefined))
  assert.ok(scopes.includes('daromadchi.uz'))
  assert.ok(scopes.includes('.daromadchi.uz'))
  assert.equal(scopes.includes('.uz'), false)
})

test('localhost and IP hosts get host-only and nothing else', () => {
  assert.deepEqual(domainScopesFor('localhost:3000'), [undefined])
  assert.deepEqual(domainScopesFor('127.0.0.1:3000'), [undefined])
})

test('a missing or empty Host header degrades to host-only, never throws', () => {
  assert.deepEqual(domainScopesFor(null), [undefined])
  assert.deepEqual(domainScopesFor(undefined), [undefined])
  assert.deepEqual(domainScopesFor('   '), [undefined])
})

test('the port is stripped and the host is lower-cased before matching', () => {
  assert.deepEqual(domainScopesFor('WWW.Daromadchi.UZ:443'), domainScopesFor('www.daromadchi.uz'))
})

// ── The emitted headers ─────────────────────────────────────────────────────

test('both cookie-name spellings are swept regardless of NODE_ENV', () => {
  // __Secure- is prefixed only in production, so a cookie from an older build
  // or a preview deploy can carry either form.
  const headers = expiredCookieHeaders('www.daromadchi.uz').join('\n')
  assert.ok(headers.includes('authjs.session-token='))
  assert.ok(headers.includes('__Secure-authjs.session-token='))
})

test('every header actually expires the cookie', () => {
  for (const h of expiredCookieHeaders('www.daromadchi.uz')) {
    assert.ok(h.includes('Max-Age=0'), h)
    assert.ok(h.includes('Expires=Thu, 01 Jan 1970'), h)
    assert.ok(h.includes('Path=/'), h)
  }
})

test('a Secure variant is emitted for every scope', () => {
  // A __Secure- cookie is rejected without the flag, so the non-Secure form
  // alone can never clear one.
  const headers = expiredCookieHeaders('www.daromadchi.uz')
  const secure = headers.filter(h => h.includes('; Secure'))
  assert.equal(secure.length, headers.length / 2, 'exactly half should carry Secure')
})

test('a host-only header carries no Domain attribute at all', () => {
  // Emitting Domain= for the host-only case would target a DIFFERENT cookie
  // and leave the one we are trying to kill in place.
  const hostOnly = expiredCookieHeaders('www.daromadchi.uz')
    .filter(h => !h.includes('Domain='))
  assert.ok(hostOnly.length > 0, 'host-only headers must exist')
  for (const h of hostOnly) assert.equal(h.includes('Domain'), false)
})

test('the callback-url cookie is swept too', () => {
  const headers = expiredCookieHeaders('www.daromadchi.uz').join('\n')
  assert.ok(headers.includes('authjs.callback-url='))
})

test('no duplicate headers are emitted', () => {
  const headers = expiredCookieHeaders('www.daromadchi.uz')
  assert.equal(new Set(headers).size, headers.length)
})

test('the name list stays a superset of what the config writes today', () => {
  for (const n of ['authjs.session-token', '__Secure-authjs.session-token']) {
    assert.ok((SESSION_COOKIE_NAMES as readonly string[]).includes(n), n)
  }
})
