import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-cbc'

/**
 * WHY THIS FILE FAILS LOUDLY
 *
 * `encrypt()` used to return its plaintext unchanged when ENCRYPTION_KEY was
 * absent — commented "graceful degradation". It was not graceful. It meant a
 * deploy that forgot the variable, or set it to something that is not 32 bytes
 * of base64, stored every seller's marketplace API token and every ATMOS card
 * token in the database as plain text, with no error, no warning and nothing
 * observable from outside. The state then self-heals on the next good deploy,
 * leaving the plaintext rows behind and no trace of when it happened.
 *
 * The asymmetry gave it away: `decrypt()` has always thrown on a missing key,
 * so the read path treated the same misconfiguration as fatal while the write
 * path treated it as fine.
 *
 * Two distinct failures, deliberately handled differently:
 *
 *   MALFORMED (set, but not 32 bytes of base64) — always fatal, everywhere.
 *   There is no environment in which a typo'd key is the intended
 *   configuration, and today it silently produces plaintext. Throwing here can
 *   only fire in a state that is already broken.
 *
 *   ABSENT — fatal in production, loud warning elsewhere. Local development and
 *   the test suite legitimately run without a key; production storing
 *   credentials in the clear is not a degraded mode, it is a breach waiting to
 *   be found. A shop connection that fails with a clear error is strictly
 *   better than one that quietly succeeds and leaves a token readable to anyone
 *   who reaches the database.
 */

class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncryptionKeyError'
  }
}

type KeyState =
  | { kind: 'ok'; key: Buffer }
  | { kind: 'absent' }
  | { kind: 'malformed'; reason: string }

function keyState(): KeyState {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || raw.trim() === '') return { kind: 'absent' }
  let buf: Buffer
  try {
    buf = Buffer.from(raw, 'base64')
  } catch {
    return { kind: 'malformed', reason: 'not valid base64' }
  }
  // Buffer.from is famously permissive — it drops characters it cannot decode
  // rather than throwing — so the length check is what actually catches a typo.
  if (buf.length !== 32) {
    return { kind: 'malformed', reason: `decodes to ${buf.length} bytes, expected 32` }
  }
  return { kind: 'ok', key: buf }
}

const IN_PRODUCTION = () => process.env.NODE_ENV === 'production'

/** Warn once per process, so a dev server does not scroll the message away. */
let warnedAbsent = false

/**
 * Returns `enc:<iv_hex>:<ciphertext_hex>`.
 *
 * Throws rather than returning plaintext when the key is missing in production
 * or malformed anywhere. Outside production a missing key returns the plaintext
 * with a loud warning, which is what local development and the test suite rely
 * on — see the note at the top of this file.
 */
export function encrypt(plaintext: string): string {
  const state = keyState()

  if (state.kind === 'malformed') {
    throw new EncryptionKeyError(
      `ENCRYPTION_KEY is set but unusable: ${state.reason}. It must be 32 bytes ` +
      `base64-encoded — generate one with: openssl rand -base64 32. Refusing to ` +
      `store a credential, because the alternative is storing it in plain text.`,
    )
  }

  if (state.kind === 'absent') {
    if (IN_PRODUCTION()) {
      throw new EncryptionKeyError(
        'ENCRYPTION_KEY is not set. Refusing to store a credential in plain text. ' +
        'Set it in the server environment and restart — generate one with: ' +
        'openssl rand -base64 32.',
      )
    }
    if (!warnedAbsent) {
      warnedAbsent = true
      console.warn(
        '[crypto] ENCRYPTION_KEY is not set — credentials are being stored in ' +
        'PLAIN TEXT. Fine for local development; fatal in production.',
      )
    }
    return plaintext
  }

  const iv     = randomBytes(16)
  const cipher = createCipheriv(ALGO, state.key, iv)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `enc:${iv.toString('hex')}:${enc.toString('hex')}`
}

/** True if the value is in the `enc:<iv>:<ciphertext>` format. */
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:') && value.split(':').length === 3
}

/**
 * Decrypts `enc:…` values; returns anything else unchanged.
 *
 * The passthrough is not a fallback — it is how rows written before this
 * project encrypted anything, and rows written while the key was missing, stay
 * readable. `isEncrypted()` is the way to ask whether a stored value is
 * actually protected.
 */
export function decrypt(value: string): string {
  if (!value.startsWith('enc:')) return value
  const state = keyState()
  if (state.kind !== 'ok') {
    throw new EncryptionKeyError(
      state.kind === 'absent'
        ? 'ENCRYPTION_KEY is required to decrypt stored credentials, and is not set.'
        : `ENCRYPTION_KEY is set but unusable: ${state.reason}.`,
    )
  }
  const parts = value.split(':')
  if (parts.length !== 3) return value
  const iv       = Buffer.from(parts[1], 'hex')
  const encBuf   = Buffer.from(parts[2], 'hex')
  const decipher = createDecipheriv(ALGO, state.key, iv)
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8')
}

/**
 * Whether credential encryption is correctly configured.
 *
 * For diagnostics and startup checks — it reports the STATE, never the key. A
 * caller that needs to tell an operator what is wrong should use `reason`.
 */
export function encryptionStatus(): { ok: boolean; reason: string | null } {
  const state = keyState()
  if (state.kind === 'ok') return { ok: true, reason: null }
  return {
    ok: false,
    reason: state.kind === 'absent'
      ? 'ENCRYPTION_KEY is not set'
      : `ENCRYPTION_KEY is unusable: ${state.reason}`,
  }
}
