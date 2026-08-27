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
import { encrypt, decrypt, isEncrypted, isLegacyEncryption, encryptionStatus } from './crypto'
import { createCipheriv, randomBytes as rnd } from 'node:crypto'

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
  it('encrypts to the gcm: format and decrypts back', () => {
    setEnv(GOOD_KEY, 'production')
    const secret = 'uzum-api-token-abc123'
    const enc = encrypt(secret)
    assert.ok(enc.startsWith('gcm:'), 'tagged so isEncrypted can recognise it')
    assert.equal(enc.split(':').length, 4, 'prefix, iv, tag, ciphertext')
    assert.ok(!enc.includes(secret), 'and the plaintext is not sitting in it')
    assert.equal(isEncrypted(enc), true)
    assert.equal(isLegacyEncryption(enc), false)
    assert.equal(decrypt(enc), secret)
  })

  it('round-trips a value with colons in it, which the format is full of', () => {
    setEnv(GOOD_KEY, 'production')
    const secret = 'Bearer:abc:def::ghi'
    assert.equal(decrypt(encrypt(secret)), secret)
  })

  it('round-trips non-ASCII, since shop names and notes reach this too', () => {
    setEnv(GOOD_KEY, 'production')
    const secret = 'токен-калит-🔐'
    assert.equal(decrypt(encrypt(secret)), secret)
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

// Every credential in the database today is CBC, and nothing rewrites those
// rows on its own — they change format only when a seller next saves that
// credential. If this suite ever goes green with the legacy branch removed,
// every seller is locked out of their own shop.
function legacyCbc(plaintext: string, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64')
  const iv  = rnd(16)
  const c   = createCipheriv('aes-256-cbc', key, iv)
  const out = Buffer.concat([c.update(plaintext, 'utf8'), c.final()])
  return `enc:${iv.toString('hex')}:${out.toString('hex')}`
}

describe('rows written by the old CBC code stay readable', () => {
  it('decrypts a legacy enc: value with the same key', () => {
    setEnv(GOOD_KEY, 'production')
    const old = legacyCbc('uzum-token-written-in-2025', GOOD_KEY)
    assert.equal(decrypt(old), 'uzum-token-written-in-2025')
  })

  it('recognises it as encrypted, and as the older cipher', () => {
    setEnv(GOOD_KEY, 'production')
    const old = legacyCbc('x', GOOD_KEY)
    assert.equal(isEncrypted(old), true)
    assert.equal(isLegacyEncryption(old), true)
  })

  it('re-encrypting a legacy value moves it to GCM', () => {
    setEnv(GOOD_KEY, 'production')
    const old = legacyCbc('rotate-me', GOOD_KEY)
    const now = encrypt(decrypt(old))
    assert.ok(now.startsWith('gcm:'))
    assert.equal(isLegacyEncryption(now), false)
    assert.equal(decrypt(now), 'rotate-me')
  })
})

// The reason for the move. CBC decrypts an edited ciphertext without
// complaining, so a row rewritten in the database becomes a string this app
// then sends to a marketplace as a credential. GCM's tag makes that a throw.
describe('a tampered ciphertext is refused, not decrypted', () => {
  it('rejects a flipped byte in the ciphertext', () => {
    setEnv(GOOD_KEY, 'production')
    const parts = encrypt('uzum-api-token-abc123').split(':')
    const ct = Buffer.from(parts[3], 'hex')
    ct[0] ^= 0xff
    parts[3] = ct.toString('hex')
    assert.throws(() => decrypt(parts.join(':')))
  })

  it('rejects a substituted auth tag', () => {
    setEnv(GOOD_KEY, 'production')
    const parts = encrypt('uzum-api-token-abc123').split(':')
    parts[2] = rnd(16).toString('hex')
    assert.throws(() => decrypt(parts.join(':')))
  })

  it('rejects a tag of the wrong length rather than guessing', () => {
    setEnv(GOOD_KEY, 'production')
    const parts = encrypt('secret').split(':')
    parts[2] = rnd(8).toString('hex')
    assert.throws(() => decrypt(parts.join(':')), /well-formed AES-GCM/)
  })

  it('rejects a ciphertext re-encrypted under a different key', () => {
    setEnv(GOOD_KEY, 'production')
    const enc = encrypt('secret')
    setEnv(rnd(32).toString('base64'), 'production')
    assert.throws(() => decrypt(enc))
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
