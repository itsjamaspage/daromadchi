/**
 * Pure, dependency-free ATMOS verification helpers: the callback MD5 signature
 * and IPv4 CIDR matching. No env, no network, no `server-only` — so this is fully
 * unit-testable under `node --test`. lib/billing/atmos.ts re-exports these.
 */

import { createHash, timingSafeEqual } from 'crypto'

// ── Callback signature: classic + MD5 ─────────────────────────────────────────
//
// sign == md5(store_id + transaction_id + account + amount + ATMOS_CALLBACK_API_KEY)
// concatenated with NO separators, in that exact order. `amount` MUST be the value
// ATMOS sent in the callback, byte-for-byte.

export interface CallbackSignParts {
  storeId: string | number
  transactionId: string
  account: string
  amount: string | number
  apiKey: string
}

export function atmosCallbackSignPayload(p: CallbackSignParts): string {
  return `${p.storeId}${p.transactionId}${p.account}${p.amount}${p.apiKey}`
}

export function computeCallbackSign(p: CallbackSignParts): string {
  return createHash('md5').update(atmosCallbackSignPayload(p), 'utf8').digest('hex')
}

/** Constant-time verification of the callback `sign`. Fails closed on any mismatch. */
export function verifyCallbackSign(providedSign: unknown, p: CallbackSignParts): boolean {
  if (typeof providedSign !== 'string' || providedSign.length === 0) return false
  const expected = computeCallbackSign(p)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(providedSign.trim().toLowerCase(), 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ── Callback source-IP helpers ────────────────────────────────────────────────

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    n = (n << 8) | octet
  }
  return n >>> 0
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt === null || baseInt === null) return false
  if (bits === 0) return true
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

// Match an IP against a LIST of CIDRs (comma/space/semicolon-separated). ATMOS
// callbacks arrive from more than one network — the documented 92.63.207.0/24
// AND, in production, the CDN77-Amsterdam pool 152.233.12.0/23 (address varies
// per payment). A single-CIDR check keyed on the documented range silently drops
// live payments, so the allowlist (when enabled) must accept every real range.
// Empty/blank list ⇒ false (fail closed).
export function ipInAnyCidr(ip: string, cidrList: string): boolean {
  const cidrs = cidrList.split(/[\s,;]+/).map(c => c.trim()).filter(Boolean)
  return cidrs.some(cidr => ipInCidr(ip, cidr))
}

// Real client IP from behind the reverse proxy: leftmost X-Forwarded-For entry,
// falling back to a directly-observed address.
export function clientIpFromForwarded(xff: string | null | undefined, fallback?: string | null): string | null {
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return fallback?.trim() || null
}
