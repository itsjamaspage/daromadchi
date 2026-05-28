// Generate key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? ''
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  return Buffer.from(hex, 'hex')
}

// Returns "ivHex:authTagHex:ciphertextHex"
export function encrypt(plaintext: string): string {
  const key    = getKey()
  const iv     = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format — expected iv:tag:enc')
  const [ivHex, tagHex, encHex] = parts
  const key      = getKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8')
}

// Two colons = encrypted format; one colon or zero = plaintext (legacy)
export function isEncrypted(value: string): boolean {
  return (value.match(/:/g) ?? []).length === 2
}

// Safe decrypt — returns plaintext as-is if not yet migrated
export function decryptKey(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored
}
