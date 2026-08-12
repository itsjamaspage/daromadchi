// Token-cache expiry/refresh with a mocked fetcher + controllable clock. No HTTP.
// Run: node --import tsx --test lib/atmos/client.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTokenManager } from './client'
import type { AtmosEnv } from './env'

const fakeEnv: AtmosEnv = {
  authUrl: 'http://x', baseUrl: 'http://x', consumerKey: 'k', consumerSecret: 's',
  storeId: '1', callbackApiKey: 'a', callbackCidr: '92.63.207.0/24',
}

describe('createTokenManager — caches until near expiry, then refreshes', () => {
  it('fetches once, serves cached within the window, refetches after the margin, and on reset', async () => {
    let clock = 1_000_000
    let calls = 0
    const mgr = createTokenManager({
      env: () => fakeEnv,
      fetchToken: async () => { calls++; return { access_token: `tok${calls}`, expires_in: 3600 } },
      now: () => clock,
      refreshMarginMs: 60_000,
    })

    // First call fetches.
    assert.equal(await mgr.get(), 'tok1')
    assert.equal(calls, 1)

    // Well within the 3600s window (minus 60s margin) → cached, no new fetch.
    clock += 3_000_000
    assert.equal(await mgr.get(), 'tok1')
    assert.equal(calls, 1)

    // Past (expiry − margin): expiresAt=T0+3.6M, margin 60k → threshold T0+3.54M.
    clock += 600_000 // now T0+3.6M > threshold
    assert.equal(await mgr.get(), 'tok2')
    assert.equal(calls, 2)

    // reset() forces a refetch on the next get.
    mgr.reset()
    assert.equal(mgr.peek(), null)
    assert.equal(await mgr.get(), 'tok3')
    assert.equal(calls, 3)
  })

  it('does not refetch when a second get happens at the same instant', async () => {
    let calls = 0
    const mgr = createTokenManager({
      env: () => fakeEnv,
      fetchToken: async () => { calls++; return { access_token: 't', expires_in: 3600 } },
      now: () => 5_000_000,
    })
    await mgr.get()
    await mgr.get()
    assert.equal(calls, 1)
  })
})
