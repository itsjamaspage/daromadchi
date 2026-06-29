import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-cbc'

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) return null
  const buf = Buffer.from(raw, 'base64')
  return buf.length === 32 ? buf : null
}

// Returns `enc:<iv_hex>:<ciphertext_hex>` when ENCRYPTION_KEY is set,
// otherwise returns plaintext unchanged (graceful degradation).
export function encrypt(plaintext: string): string {
  const key = getKey()
  if (!key) return plaintext
  const iv      = randomBytes(16)
  const cipher  = createCipheriv(ALGO, key, iv)
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `enc:${iv.toString('hex')}:${enc.toString('hex')}`
}

// Returns true if the value is in the `enc:<iv>:<ciphertext>` format.
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:') && value.split(':').length === 3
}

// Decrypts `enc:…` values; returns other values unchanged (backward compat).
export function decrypt(value: string): string {
  if (!value.startsWith('enc:')) return value
  const key = getKey()
  if (!key) throw new Error('ENCRYPTION_KEY env var is required to decrypt tokens')
  const parts = value.split(':')
  if (parts.length !== 3) return value
  const iv     = Buffer.from(parts[1], 'hex')
  const encBuf = Buffer.from(parts[2], 'hex')
  const decipher = createDecipheriv(ALGO, key, iv)
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8')
}
