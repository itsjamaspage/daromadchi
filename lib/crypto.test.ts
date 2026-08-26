/**
 * The credential-encryption contract.
 *
 * The bug these pin: `encrypt()` returned its plaintext unchanged when
 * ENCRYPTION_KEY was absent or malformed, so a misconfigured deploy stored
 * marketplace API tokens and ATMOS card tokens in the clear, silently.
 *
 * Run: node --import tsx --test lib/crypto.test.ts
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { encrypt, decrypt, isEncrypted, encryptionStatus } from './crypto'

const GOOD_KEY = randomBytes(32).toString('base64')

let savedKey: string | undefined
let savedEnv: string | undefined

beforeEach(() => {
  savedKey = process.env.ENCRYPTION_KEY
  savedEnv = process.env.NODE_ENV
})
afterEach(() => {
  if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = savedKey
  if (savedEnv === undefined) delete (process.env as Record<string, unknown>).NODE_ENV
  else (process.env as Record<string, string>).NODE_ENV = savedEnv
})

// A plain static import is enough: the module reads process.env on every call
// rather than caching a key at load, so each test can set the environment it
// wants. (Top-level await is not available here — the package is CommonJS.)

const setEnv = (key: string | undefined, nodeEnv: string) => {
  if (key === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = key
  ;(process.env as Record<string, string>).NODE_ENV = nodeEnv
}

describe('a round trip, with a good key', () => {
  it('encrypts to the enc: format and decrypts back', () => {
    setEnv(GOOD_KEY, 'production')
    const secret = 'uzum-api-token-abc123'
    const enc = encrypt(secret)
    assert.ok(enc.startsWith('enc:'), 'tagged so isEncrypted can recognise it')
    assert.ok(!enc.includes(secret), 'and the plaintext is not sitting in it')
    assert.equal(isEncrypted(enc), true)
    assert.equal(decrypt(enc), secret)
  })

  it('uses a fresh IV, so the same secret does not encrypt to the same bytes', () => {
    setEnv(GOOD_KEY, 'production')
    assert.notEqual(encrypt('same-token'), encrypt('same-token'))
  })
})

describe('a MALFORMED key is fatal everywhere', () => {
  // Buffer.from(…, 'base64') drops characters it cannot decode instead of
  // throwing, so a typo'd key quietly became a short buffer and then plaintext.
  for (const [label, bad] of [
    ['too short', Buffer.alloc(16).toString('base64')],
    ['too long', Buffer.alloc(64).toString('base64')],
    ['not base64 at all', 'this is not a key!!'],
  ] as const) {
    it(`refuses to encrypt when the key is ${label}`, () => {
      for (const env of ['production', 'development', 'test']) {
        setEnv(bad, env)
        assert.throws(() => encrypt('secret'), /ENCRYPTION_KEY is set but unusable/,
          `must throw in NODE_ENV=${env} — a typo'd key is never intentional`)
      }
    })
  }

  it('never returns the plaintext for a malformed key', () => {
    setEnv('short', 'development')
    let out: string | null = null
    try { out = encrypt('uzum-api-token-abc123') } catch { /* expected */ }
    assert.equal(out, null, 'the old code returned the token itself here')
  })
})

describe('an ABSENT key is fatal in production only', () => {
  it('refuses to store a credential in production', () => {
    setEnv(undefined, 'production')
    assert.throws(() => encrypt('uzum-api-token-abc123'), /Refusing to store a credential in plain text/)
  })

  it('treats an empty string as absent, not as a key', () => {
    setEnv('   ', 'production')
    assert.throws(() => encrypt('secret'), /Refusing to store a credential in plain text/)
  })

  it('still passes through in development, where there is no key by design', () => {
    setEnv(undefined, 'development')
    assert.equal(encrypt('local-token'), 'local-token')
  })
})

describe('decrypt', () => {
  it('returns a non-enc: value unchanged — rows written before encryption existed', () => {
    setEnv(GOOD_KEY, 'production')
    assert.equal(decrypt('plain-legacy-token'), 'plain-legacy-token')
    assert.equal(isEncrypted('plain-legacy-token'), false, 'and says so')
  })

  it('throws rather than returning ciphertext when the key is gone', () => {
    setEnv(GOOD_KEY, 'production')
    const enc = encrypt('secret')
    setEnv(undefined, 'production')
    assert.throws(() => decrypt(enc), /ENCRYPTION_KEY is required/)
  })
})

describe('encryptionStatus, for diagnostics', () => {
  it('reports the state without ever revealing the key', () => {
    setEnv(GOOD_KEY, 'production')
    assert.deepEqual(encryptionStatus(), { ok: true, reason: null })

    setEnv(undefined, 'production')
    const absent = encryptionStatus()
    assert.equal(absent.ok, false)
    assert.match(absent.reason!, /not set/)

    setEnv('short', 'production')
    const bad = encryptionStatus()
    assert.equal(bad.ok, false)
    assert.match(bad.reason!, /unusable/)
    assert.ok(!bad.reason!.includes('short'), 'the reason must not echo the value')
  })
})
